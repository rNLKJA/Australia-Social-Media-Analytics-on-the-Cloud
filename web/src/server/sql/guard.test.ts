import { existsSync, rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { SCHEMA } from "@/lib/sql/schema";
import { analyticsDbPath } from "../db";
import { runGuardedQuery } from "./execute";
import { guardSql, MAX_ROWS } from "./guard";

const codes = (sql: string) => guardSql(sql).issues.map((i) => i.code);

describe("guardSql: queries that should run", () => {
  const ok = [
    "SELECT key, value FROM facts",
    "select count(*) as n from regions_lga;",
    "SELECT r.name, t.avg_score FROM twitter_sal_sentiment t JOIN regions_sal r USING (sal_code) WHERE t.topic = 'all' AND t.state = 'Victoria' ORDER BY t.tweet_count DESC LIMIT 5",
    "WITH v AS (SELECT lga_name, total FROM crime_lga WHERE iqr_kept = 1) SELECT lga_name FROM v ORDER BY total DESC LIMIT 1",
    "SELECT score, SUM(count) * 1.0 / (SELECT SUM(count) FROM sentiment_histogram WHERE source = 'twitter' AND topic = 'crime') AS share FROM sentiment_histogram WHERE source = 'twitter' AND topic = 'crime' GROUP BY score",
    "SELECT lga_name, RANK() OVER (ORDER BY total DESC) AS rk FROM crime_lga",
    "SELECT lang, ROUND(100.0 * b5 / toots, 1) AS pct_neutral FROM mastodon_language WHERE server = 'mastodon.social' ORDER BY toots DESC LIMIT 10",
    "SELECT name FROM regions_sal WHERE sal_code IN (SELECT sal_code FROM twitter_sal_sentiment WHERE topic = 'crime') LIMIT 3",
    "SELECT lga_name FROM crime_lga UNION SELECT name FROM regions_lga",
    "SELECT x.n FROM (SELECT COUNT(*) AS n FROM income_sa2 WHERE state = 'Victoria') x",
    "SELECT IIF(total > 10000, 'high', 'low') AS band, COUNT(*) FROM crime_lga GROUP BY band",
    "SELECT CAST(value AS INTEGER) AS v FROM facts WHERE key = 'tweets_processed' -- a comment",
    "SELECT \"name\" FROM regions_lga WHERE name LIKE 'Greater%'",
    "SELECT name || ' (' || state || ')' AS label FROM regions_sal LIMIT 3",
    "WITH a AS (SELECT lga_name, total FROM crime_lga), b AS (SELECT lga_name FROM a WHERE total > 10000) SELECT lga_name FROM b",
  ];
  for (const sql of ok) {
    it(sql.slice(0, 70), () => {
      const g = guardSql(sql);
      expect(g.issues).toEqual([]);
      expect(g.ok).toBe(true);
      expect(g.executedSql).toContain(`LIMIT ${MAX_ROWS + 1}`);
    });
  }
  it("records tables and functions, and whether the row cap applies", () => {
    const g = guardSql("SELECT COUNT(*) FROM crime_lga c JOIN regions_lga r USING (lga_code)");
    expect(g.tables.sort()).toEqual(["crime_lga", "regions_lga"]);
    expect(g.functions).toEqual(["count"]);
    expect(g.limitApplied).toBe(true);
    expect(guardSql("SELECT name FROM regions_lga LIMIT 10").limitApplied).toBe(false);
    expect(guardSql("SELECT name FROM regions_lga LIMIT 5000").limitApplied).toBe(true);
  });
});

describe("guardSql: queries that must be blocked", () => {
  const cases: [string, string][] = [
    ["", "empty"],
    ["DROP TABLE facts", "forbidden_keyword"],
    ["SELECT 1; DROP TABLE facts", "multiple_statements"],
    ["SELECT 1; SELECT 2", "multiple_statements"],
    ["PRAGMA table_info(facts)", "forbidden_keyword"],
    ["ATTACH DATABASE '/tmp/x.db' AS x", "forbidden_keyword"],
    ["INSERT INTO facts(key, value) VALUES ('x', 1)", "forbidden_keyword"],
    ["UPDATE facts SET value = 0", "forbidden_keyword"],
    ["DELETE FROM facts", "forbidden_keyword"],
    ["CREATE TABLE x (a)", "forbidden_keyword"],
    ["SELECT * FROM sqlite_master", "unknown_table"],
    ["SELECT * FROM sqlite_schema", "unknown_table"],
    ["SELECT * FROM pragma_table_info('facts')", "table_function"],
    ["SELECT * FROM main.facts AS f JOIN temp.facts g ON f.key = g.key", "schema_qualifier"],
    ["SELECT load_extension('/tmp/evil')", "function_not_allowed"],
    ["SELECT randomblob(1000000000)", "function_not_allowed"],
    ["SELECT printf('%.*c', 1000000000, 'x')", "function_not_allowed"],
    ["SELECT sqlite_version()", "function_not_allowed"],
    ["WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT x FROM c", "forbidden_keyword"],
    // SQLite treats a self-referencing CTE as recursive even without the keyword
    ["WITH c AS (SELECT 1 AS x UNION ALL SELECT x + 1 FROM c) SELECT count(*) AS n FROM c", "recursive_cte"],
    [
      "WITH c AS (SELECT 1 AS x UNION ALL SELECT x + 1 FROM c WHERE x < 100000) SELECT count(*) AS n FROM c",
      "recursive_cte",
    ],
    [
      "WITH c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM (SELECT x FROM c) s) SELECT x FROM c",
      "recursive_cte",
    ],
    ["WITH facts AS (SELECT key, value FROM facts) SELECT key FROM facts", "recursive_cte"],
    // a CTE may only use CTEs defined before it
    ["WITH a AS (SELECT n FROM b), b AS (SELECT 1 AS n) SELECT n FROM a", "unknown_table"],
    ["SELECT 1 /* hidden */", "block_comment"],
    ["SELECT 'a\\' , (SELECT sql FROM sqlite_master) , '' ", "forbidden_character"],
    ["SELECT * FROM facts WHERE key = ?", "forbidden_character"],
    ["SELECT $x", "forbidden_character"],
    ["SELECT * FROM facts WHERE key = :k", "forbidden_character"],
    ["SELECT 'unterminated", "syntax"],
    ["SELEC key FROM facts", "not_select"],
    ["SELECT key FROM facts WHERE", "syntax"],
    ["SELECT nonexistent FROM facts", "unknown_column"],
    ['SELECT * FROM income_sa2 WHERE state = "Victoria"', "unknown_column"],
    ["SELECT * FROM users", "unknown_table"],
    ["VALUES (1), (2)", "not_select"],
    ["EXPLAIN SELECT 1", "not_select"],
    ["x".repeat(5000), "too_long"],
  ];
  for (const [sql, code] of cases) {
    it(`${code}: ${sql.slice(0, 60) || "(empty)"}`, () => {
      const g = guardSql(sql);
      expect(g.ok).toBe(false);
      expect(g.executedSql).toBeNull();
      expect(codes(sql)).toContain(code);
    });
  }
  it("never lets a semicolon inside a string start a new statement, nor a quote hide one", () => {
    expect(guardSql("SELECT ';DROP TABLE facts' AS x").ok).toBe(true);
    expect(guardSql("SELECT 'it''s' AS x").ok).toBe(true);
    expect(guardSql("SELECT 'x'; DROP TABLE facts; --'").ok).toBe(false);
  });
});

describe("schema docs", () => {
  it("document every table and column of analytics.db, with the right types", async () => {
    const c = createClient({ url: `file:${analyticsDbPath()}` });
    const tables = (
      await c.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
    ).rows.map((r) => String(r.name));
    expect(SCHEMA.map((t) => t.name).sort()).toEqual(tables);
    for (const t of SCHEMA) {
      const cols = (await c.execute(`PRAGMA table_info("${t.name}")`)).rows.map((r) => [
        String(r.name),
        String(r.type),
      ]);
      expect(t.columns.map((col) => [col.name, col.type])).toEqual(cols);
    }
    c.close();
  });
});

describe("runGuardedQuery (real database, read-only connection)", () => {
  it("runs an allowed query and caps the rows", async () => {
    const r = await runGuardedQuery("SELECT sal_code FROM twitter_sal_sentiment");
    expect(r.verdict).toBe("allowed");
    expect(r.rowCount).toBe(MAX_ROWS);
    expect(r.truncated).toBe(true);
    expect(r.columns).toEqual(["sal_code"]);
  });
  it("keeps ORDER BY and LIMIT inside the wrapper", async () => {
    const r = await runGuardedQuery("SELECT lga_name, total FROM crime_lga ORDER BY total DESC LIMIT 3");
    expect(r.rows.map((x) => x[0])).toEqual(["Melbourne (C)", "Casey (C)", "Greater Geelong (C)"]);
    expect(r.truncated).toBe(false);
  });
  it("supports the math functions on the allow-list", async () => {
    const r = await runGuardedQuery("SELECT ROUND(SQRT(16), 1) AS a, LOG10(1000) AS b, POWER(2, 3) AS c");
    expect(r.verdict).toBe("allowed");
    expect(r.rows[0]).toEqual([4, 3, 8]);
  });
  it("reports SQLite errors without running anything else", async () => {
    const r = await runGuardedQuery("SELECT lga_name FROM crime_lga GROUP BY nope_alias HAVING 1");
    expect(r.verdict).not.toBe("allowed");
  });
  it("blocks before touching the database", async () => {
    const r = await runGuardedQuery("DELETE FROM facts");
    expect(r.verdict).toBe("blocked");
    expect(r.rows).toEqual([]);
  });
  it("interrupts a query that runs past the time limit", async () => {
    const r = await runGuardedQuery(
      "SELECT COUNT(*) FROM twitter_sal_sentiment a JOIN regions_sal b ON a.sal_code <> b.sal_code JOIN income_sa2 c ON c.sa2_code <> b.sa2_code16",
      200,
    );
    expect(r.verdict).toBe("error");
    expect(r.error?.code).toBe("timeout");
    expect(r.elapsedMs).toBeLessThan(2000);
  });
  it("stops a query that would build a huge string (memory cap)", async () => {
    let q = "'aaaaaaaaaa'";
    for (let i = 0; i < 8; i++) q = `replace(${q}, 'a', 'aaaaaaaaaa')`;
    const sql = `SELECT length(${q}) AS n`;
    expect(guardSql(sql).ok).toBe(true); // allowed functions only, so the cap has to catch it
    const r = await runGuardedQuery(sql);
    expect(r.verdict).toBe("error");
    expect(r.error?.code).toBe("too_large");
    const cross = await runGuardedQuery("SELECT group_concat(a.name) AS s FROM regions_sal a, regions_sal b");
    expect(cross.verdict).toBe("error");
    expect(["too_large", "timeout"]).toContain(cross.error?.code);
    // ordinary queries still run afterwards
    expect((await runGuardedQuery("SELECT COUNT(*) AS n FROM facts")).verdict).toBe("allowed");
  });
  it("leaves the database unchanged and creates no files", async () => {
    const before = await runGuardedQuery("SELECT COUNT(*) FROM facts");
    const tail = "/tmp/social-sense-should-not-exist.db";
    if (existsSync(tail)) rmSync(tail);
    await runGuardedQuery(`SELECT 1) ; ATTACH DATABASE '${tail}' AS x; SELECT (1`);
    expect(existsSync(tail)).toBe(false);
    const after = await runGuardedQuery("SELECT COUNT(*) FROM facts");
    expect(after.rows).toEqual(before.rows);
  });
});
