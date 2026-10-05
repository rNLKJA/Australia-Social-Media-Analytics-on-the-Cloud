import "server-only";

import Database from "libsql/promise";
import { analyticsDbPath } from "../db";
import { guardSql, type GuardResult, MAX_ROWS } from "./guard";

export const QUERY_TIMEOUT_MS = 2500;
/**
 * Ceiling on SQLite's heap. Without it, allowed functions such as REPLACE and
 * GROUP_CONCAT can build a string of up to SQLite's 1 GB limit inside the time
 * limit. The pragma is process-wide (every SQLite connection in this server
 * shares it), which is fine here: analytics.db is 1.7 MB and no legitimate
 * query needs more than a few MB.
 */
export const HEAP_LIMIT_BYTES = 64 * 1024 * 1024;
const MAX_CELL_CHARS = 400;

export type Cell = string | number | null;

export interface QueryOutcome {
  verdict: "allowed" | "blocked" | "error";
  guard: GuardResult;
  columns: string[];
  rows: Cell[][];
  rowCount: number;
  /** more rows existed than the cap */
  truncated: boolean;
  elapsedMs: number;
  error?: { code: "timeout" | "too_large" | "sqlite"; message: string };
}

function cell(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return v.length > MAX_CELL_CHARS ? `${v.slice(0, MAX_CELL_CHARS)}…` : v;
  return "[binary]";
}

interface Statement {
  raw(on?: boolean): Statement;
  columns(): { name: string }[];
  all(): Promise<unknown[][]>;
}

/**
 * Run a guarded SELECT on a fresh connection that SQLite itself keeps
 * read-only (`PRAGMA query_only`), wrapped so only that one statement can
 * execute and at most MAX_ROWS + 1 rows come back. A timer interrupts the
 * query (sqlite3_interrupt) after QUERY_TIMEOUT_MS, and SQLite's heap is
 * capped at HEAP_LIMIT_BYTES so one query cannot exhaust the server's memory.
 */
export async function runGuardedQuery(sql: string, timeoutMs = QUERY_TIMEOUT_MS): Promise<QueryOutcome> {
  const guard = guardSql(sql);
  const base = { guard, columns: [], rows: [], rowCount: 0, truncated: false, elapsedMs: 0 };
  if (!guard.ok || !guard.executedSql) return { verdict: "blocked", ...base };

  const db = new Database(analyticsDbPath(), {});
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    await db.exec(`PRAGMA hard_heap_limit = ${HEAP_LIMIT_BYTES}`);
    await db.exec("PRAGMA query_only = 1");
    const stmt = (await db.prepare(guard.executedSql)) as Statement;
    stmt.raw(true);
    const columns = stmt.columns().map((c) => c.name);
    timer = setTimeout(() => {
      timedOut = true;
      db.interrupt();
    }, timeoutMs);
    const raw = await stmt.all();
    const elapsedMs = Math.round(performance.now() - started);
    const truncated = raw.length > MAX_ROWS;
    const rows = raw.slice(0, MAX_ROWS).map((r) => r.map(cell));
    return { verdict: "allowed", guard, columns, rows, rowCount: rows.length, truncated, elapsedMs };
  } catch (e) {
    const elapsedMs = Math.round(performance.now() - started);
    const message = e instanceof Error ? e.message : String(e);
    if (timedOut || /interrupt/i.test(message))
      return {
        verdict: "error",
        ...base,
        elapsedMs,
        error: { code: "timeout", message: `The query was stopped after ${timeoutMs} ms.` },
      };
    if (/out of memory|too big|SQLITE_(NOMEM|TOOBIG)/i.test(message))
      return {
        verdict: "error",
        ...base,
        elapsedMs,
        error: {
          code: "too_large",
          message: `The query was stopped because it needed more than ${HEAP_LIMIT_BYTES / 1024 / 1024} MB of memory. Aggregate or filter before building long strings.`,
        },
      };
    return {
      verdict: "error",
      ...base,
      elapsedMs,
      error: { code: "sqlite", message: message.replace(/^SQLITE_\w+:\s*/, "").slice(0, 300) },
    };
  } finally {
    if (timer) clearTimeout(timer);
    db.close();
  }
}
