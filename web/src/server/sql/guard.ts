import "server-only";

import pg from "node-sql-parser/build/postgresql.js";
import { ALLOWED } from "@/lib/sql/schema";

/**
 * Server-side gate for SQL written by a visitor's language model (or by the
 * visitor). Fail closed: anything that cannot be fully understood is blocked.
 *
 * Layers, in order:
 *  1. A small SQLite-faithful lexer: one statement only, no block comments,
 *     no backslashes, no bind parameters, no write/DDL/PRAGMA/ATTACH keywords,
 *     no RECURSIVE keyword, bounded length.
 *  2. A real SQL parser (node-sql-parser, PostgreSQL grammar, whose quoting
 *     rules match SQLite's: 'text', "identifier"): the statement must be a
 *     single SELECT; every table must be on the allow-list (or a CTE defined
 *     earlier in the query: a CTE that refers to itself is recursive in
 *     SQLite even without the RECURSIVE keyword, so it is refused); every column must exist in a referenced table (or be an
 *     alias); every function must be on the allow-list; table-valued
 *     functions and schema qualifiers other than `main` are refused.
 *  3. Execution (execute.ts) wraps the statement as
 *     `SELECT * FROM (...) LIMIT 201` on a fresh read-only (`query_only`)
 *     connection with a hard timeout, so only that one SELECT can run.
 */

export const MAX_SQL_CHARS = 4000;
export const MAX_ROWS = 200;
const MAX_TABLE_REFS = 8;
const MAX_SUBQUERY_DEPTH = 3;

export const ALLOWED_FUNCTIONS = new Set([
  // aggregates
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "total",
  "group_concat",
  // window functions
  "row_number",
  "rank",
  "dense_rank",
  "percent_rank",
  "cume_dist",
  "ntile",
  "lag",
  "lead",
  "first_value",
  "last_value",
  "nth_value",
  // scalar
  "abs",
  "round",
  "lower",
  "upper",
  "length",
  "substr",
  "substring",
  "trim",
  "ltrim",
  "rtrim",
  "replace",
  "instr",
  "coalesce",
  "ifnull",
  "nullif",
  "iif",
  "typeof",
  "sqrt",
  "power",
  "pow",
  "exp",
  "ln",
  "log",
  "log10",
  "log2",
  "floor",
  "ceil",
  "ceiling",
  "sign",
  "mod",
  "pi",
  "date",
  "time",
  "datetime",
  "strftime",
  "julianday",
]);

/** Statement keywords that never belong in a read-only query (checked on lexer tokens, not inside strings). */
const FORBIDDEN_WORDS = new Set([
  "pragma",
  "attach",
  "detach",
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "vacuum",
  "reindex",
  "analyze",
  "trigger",
  "savepoint",
  "release",
  "rollback",
  "commit",
  "begin",
  "recursive",
]);

export type IssueCode =
  | "empty"
  | "too_long"
  | "syntax"
  | "multiple_statements"
  | "forbidden_keyword"
  | "forbidden_character"
  | "block_comment"
  | "not_select"
  | "unknown_table"
  | "recursive_cte"
  | "schema_qualifier"
  | "table_function"
  | "unknown_column"
  | "function_not_allowed"
  | "too_complex";

export interface GuardIssue {
  code: IssueCode;
  message: string;
}

export interface GuardResult {
  ok: boolean;
  issues: GuardIssue[];
  /** the statement as it will run inside the wrapper (trailing semicolons removed) */
  sql: string;
  /** what the database actually executes */
  executedSql: string | null;
  tables: string[];
  functions: string[];
  /** the query had no LIMIT (or a larger one), so the row cap applies */
  limitApplied: boolean;
}

interface Token {
  kind: "word" | "string" | "ident" | "number" | "punct" | "semicolon";
  text: string;
}

/** A minimal SQLite tokenizer, enough to reason about statement boundaries and keywords. */
export function lex(sql: string): { tokens: Token[]; issues: GuardIssue[] } {
  const tokens: Token[] = [];
  const issues: GuardIssue[] = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "-" && sql[i + 1] === "-") {
      while (i < n && sql[i] !== "\n") i++;
    } else if (ch === "/" && sql[i + 1] === "*") {
      issues.push({
        code: "block_comment",
        message: "Block comments (/* */) are not accepted; use -- comments.",
      });
      return { tokens, issues };
    } else if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      for (;;) {
        if (j >= n) {
          issues.push({ code: "syntax", message: "Unterminated quoted string or identifier." });
          return { tokens, issues };
        }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) j += 2;
          else break;
        } else j++;
      }
      tokens.push({ kind: ch === "'" ? "string" : "ident", text: sql.slice(i, j + 1) });
      i = j + 1;
    } else if (ch === "[") {
      const j = sql.indexOf("]", i + 1);
      if (j < 0) {
        issues.push({ code: "syntax", message: "Unterminated [identifier]." });
        return { tokens, issues };
      }
      tokens.push({ kind: "ident", text: sql.slice(i, j + 1) });
      i = j + 1;
    } else if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) j++;
      tokens.push({ kind: "word", text: sql.slice(i, j) });
      i = j;
    } else if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (
        j < n &&
        (/[0-9A-Za-z_.]/.test(sql[j]) || ((sql[j] === "+" || sql[j] === "-") && /[eE]/.test(sql[j - 1])))
      )
        j++;
      tokens.push({ kind: "number", text: sql.slice(i, j) });
      i = j;
    } else if (ch === ";") {
      tokens.push({ kind: "semicolon", text: ";" });
      i++;
    } else if (ch === "\\" || ch === "$" || ch === "?" || ch === "@" || ch === "#" || ch === ":") {
      issues.push({
        code: "forbidden_character",
        message: `The character "${ch}" is not accepted (no escapes or bind parameters).`,
      });
      return { tokens, issues };
    } else {
      tokens.push({ kind: "punct", text: ch });
      i++;
    }
  }
  // backslashes inside strings: the parser and SQLite disagree about them, so refuse outright
  if (tokens.some((t) => (t.kind === "string" || t.kind === "ident") && t.text.includes("\\")))
    issues.push({ code: "forbidden_character", message: 'The character "\\" is not accepted.' });
  return { tokens, issues };
}

type Node = Record<string, unknown>;
const isObj = (v: unknown): v is Node => typeof v === "object" && v !== null;

function nameOf(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (isObj(v)) {
    if (typeof v.value === "string") return v.value;
    if (isObj(v.expr) && typeof v.expr.value === "string") return v.expr.value;
    if (Array.isArray(v.name)) return v.name.map((p) => nameOf(p) ?? "").join(".");
    if (v.name !== undefined) return nameOf(v.name);
  }
  return null;
}

const parser = new pg.Parser();
const PARSE_OPT = { database: "postgresql" };

/** Validate one SQL statement. Pure: never touches the database. */
export function guardSql(input: string): GuardResult {
  const issues: GuardIssue[] = [];
  const tables = new Set<string>();
  const functions = new Set<string>();
  const result = (sql: string, limitApplied = false): GuardResult => ({
    ok: issues.length === 0,
    issues,
    sql,
    executedSql: issues.length === 0 ? `SELECT * FROM (\n${sql}\n) LIMIT ${MAX_ROWS + 1}` : null,
    tables: [...tables],
    functions: [...functions],
    limitApplied,
  });

  let sql = input.trim();
  if (!sql) {
    issues.push({ code: "empty", message: "No SQL to run." });
    return result(sql);
  }
  if (sql.length > MAX_SQL_CHARS) {
    issues.push({ code: "too_long", message: `SQL is limited to ${MAX_SQL_CHARS} characters.` });
    return result(sql);
  }

  // ---- 1. lexer ------------------------------------------------------------------
  const { tokens, issues: lexIssues } = lex(sql);
  issues.push(...lexIssues);
  if (issues.length) return result(sql);
  // trailing semicolons are fine; any other semicolon starts a second statement
  let last = tokens.length - 1;
  while (last >= 0 && tokens[last].kind === "semicolon") last--;
  if (tokens.slice(0, last + 1).some((t) => t.kind === "semicolon")) {
    issues.push({ code: "multiple_statements", message: "Only one statement is allowed." });
    return result(sql);
  }
  sql = sql.replace(/[;\s]+$/, "");
  const bad = [
    ...new Set(
      tokens
        .filter((t) => t.kind === "word" && FORBIDDEN_WORDS.has(t.text.toLowerCase()))
        .map((t) => t.text.toUpperCase()),
    ),
  ];
  if (bad.length) {
    issues.push({
      code: "forbidden_keyword",
      message: `Read-only queries cannot use ${bad.join(", ")}.`,
    });
    return result(sql);
  }
  const first = tokens.find((t) => t.kind === "word")?.text.toLowerCase();
  if (first !== "select" && first !== "with") {
    issues.push({
      code: "not_select",
      message: "Only SELECT queries (optionally starting with WITH) are allowed.",
    });
    return result(sql);
  }

  // ---- 2. parser -----------------------------------------------------------------
  let ast: unknown;
  let tableList: string[];
  try {
    ast = parser.astify(sql, PARSE_OPT);
    tableList = parser.tableList(sql, PARSE_OPT);
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "parse error";
    issues.push({ code: "syntax", message: `The SQL could not be parsed: ${msg}` });
    return result(sql);
  }
  const stmts = Array.isArray(ast) ? ast : [ast];
  if (stmts.length !== 1) {
    issues.push({ code: "multiple_statements", message: "Only one statement is allowed." });
    return result(sql);
  }
  const root = stmts[0] as Node;
  if (root.type !== "select") {
    issues.push({ code: "not_select", message: "Only SELECT queries are allowed." });
    return result(sql);
  }

  // CTE names and declared columns
  const ctes = new Set<string>();
  /** CTEs whose body is being walked (not yet in scope) */
  const defining: string[] = [];
  const aliases = new Set<string>();
  const columnRefs: string[] = [];
  let tableRefs = 0;
  let maxDepth = 0;

  const walk = (v: unknown, depth: number): void => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth);
      return;
    }
    if (!isObj(v)) return;
    // subquery wrapper
    if (isObj(v.ast)) {
      maxDepth = Math.max(maxDepth, depth + 1);
      walk(v.ast, depth + 1);
      return;
    }
    if (Array.isArray(v.with)) {
      // In order: a CTE's body is checked before its own name comes into
      // scope, so a body that refers to itself (SQLite treats that as a
      // recursive CTE, with or without the RECURSIVE keyword) or to a CTE
      // defined after it is refused rather than run.
      for (const w of v.with as Node[]) {
        const name = nameOf(w.name)?.toLowerCase() ?? null;
        if (name) defining.push(name);
        walk(w.stmt, depth + 1);
        if (name) {
          defining.pop();
          ctes.add(name);
        }
        if (Array.isArray(w.columns))
          for (const col of w.columns) {
            const cn = nameOf(col);
            if (cn) aliases.add(cn.toLowerCase());
          }
      }
    }
    if (Array.isArray(v.columns) && v.type === "select") {
      for (const col of v.columns as Node[]) {
        const a = nameOf(col.as);
        if (a) aliases.add(a.toLowerCase());
      }
    }
    if (Array.isArray(v.from)) {
      for (const f of v.from as Node[]) {
        if (typeof f.table === "string") {
          tableRefs++;
          const t = f.table.toLowerCase();
          const db = typeof f.db === "string" ? f.db.toLowerCase() : null;
          if (db && db !== "main")
            issues.push({
              code: "schema_qualifier",
              message: `Schema "${f.db}" is not available; use the table name alone.`,
            });
          if (defining.includes(t))
            issues.push({
              code: "recursive_cte",
              message: `The CTE "${f.table}" refers to itself; recursive queries are not allowed.`,
            });
          else if (!ALLOWED.has(t) && !ctes.has(t))
            issues.push({
              code: "unknown_table",
              message: `Table "${f.table}" is not one of the documented tables.`,
            });
          if (ALLOWED.has(t)) tables.add(t);
          const a = nameOf(f.as);
          if (a) aliases.add(a.toLowerCase());
        } else if (isObj(f.expr) && (f.expr as Node).type === "function") {
          issues.push({ code: "table_function", message: "Table-valued functions are not allowed in FROM." });
        } else {
          const a = nameOf(f.as);
          if (a) aliases.add(a.toLowerCase());
        }
      }
    }
    if (v.type === "function") {
      const name = (nameOf(v.name) ?? "").toLowerCase();
      functions.add(name);
    } else if (v.type === "aggr_func" || v.type === "window_func") {
      const name = (nameOf(v.name) ?? "").toLowerCase();
      functions.add(name);
    } else if (v.type === "column_ref") {
      const col = nameOf(v.column);
      if (col && col !== "*") columnRefs.push(col);
    }
    for (const [k, child] of Object.entries(v)) {
      if (k === "with" && Array.isArray(child)) continue; // walked above, in order
      if (isObj(child) || Array.isArray(child)) walk(child, depth);
    }
  };
  walk(root, 0);

  // belt and braces: the parser's own table list
  for (const entry of tableList) {
    const [, db, table] = entry.split("::");
    const t = table.toLowerCase();
    if (
      db &&
      db !== "null" &&
      db.toLowerCase() !== "main" &&
      !issues.some((x) => x.code === "schema_qualifier")
    )
      issues.push({ code: "schema_qualifier", message: `Schema "${db}" is not available.` });
    if (
      !ALLOWED.has(t) &&
      !ctes.has(t) &&
      !issues.some((x) => x.code === "unknown_table" && x.message.includes(`"${table}"`))
    )
      issues.push({
        code: "unknown_table",
        message: `Table "${table}" is not one of the documented tables.`,
      });
    if (ALLOWED.has(t)) tables.add(t);
  }

  for (const f of functions) {
    if (!ALLOWED_FUNCTIONS.has(f))
      issues.push({
        code: "function_not_allowed",
        message: `Function ${f.toUpperCase()}() is not on the allow-list.`,
      });
  }

  const known = new Set<string>(aliases);
  for (const t of tables) for (const col of ALLOWED.get(t)!) known.add(col);
  const unknown = [...new Set(columnRefs.filter((col) => !known.has(col.toLowerCase())))];
  for (const col of unknown)
    issues.push({
      code: "unknown_column",
      message: `Column "${col}" is not in the referenced tables${/[A-Z ]/.test(col) ? " (text values need 'single quotes')" : ""}.`,
    });

  if (tableRefs > MAX_TABLE_REFS)
    issues.push({ code: "too_complex", message: `At most ${MAX_TABLE_REFS} table references are allowed.` });
  if (maxDepth > MAX_SUBQUERY_DEPTH)
    issues.push({ code: "too_complex", message: `Subqueries can nest at most ${MAX_SUBQUERY_DEPTH} deep.` });

  const lim = isObj(root.limit) && Array.isArray(root.limit.value) ? (root.limit.value as Node[]) : [];
  const sep = isObj(root.limit) ? root.limit.seperator : "";
  const countNode = sep === "," ? lim[1] : lim[0];
  const count = isObj(countNode) && typeof countNode.value === "number" ? countNode.value : null;
  const limitApplied = count === null || count > MAX_ROWS;
  return result(sql, limitApplied);
}
