import { describe, expect, it } from "vitest";
import { runGuardedQuery } from "@/server/sql/execute";
import { BENCHMARK } from "./benchmark";
import { cellsEqual, resultsMatch } from "./compare";

/** Gold answers, written from the data and pinned here so a rebuilt database cannot change them silently. */
const EXPECTED: Record<string, (string | number)[][]> = {
  q01: [[719336]],
  q02: [["Southbank", 73408]],
  q03: [[72]],
  q04: [["Melbourne (C)", 26694]],
  q05: [[0.24926949876376714]],
  q06: [[5.49]],
  q07: [[339498]],
  q08: [["2023-05-04T13:00:00Z"]],
  q09: [[0.13830946158279422]],
  q10: [["Australian Capital Territory"]],
  q11: [["Melbourne"], ["Ballarat Central"], ["Geelong"], ["Hillside (Melton - Vic.)"], ["Castlemaine"]],
  q12: [[457]],
  q13: [[5.8374617161893507]],
  q14: [[520]],
};

describe("benchmark gold SQL", () => {
  it("has unique ids, 14 answerable questions and 2 that must be refused", () => {
    expect(new Set(BENCHMARK.map((b) => b.id)).size).toBe(BENCHMARK.length);
    expect(BENCHMARK.filter((b) => b.goldSql).length).toBe(14);
    expect(BENCHMARK.filter((b) => !b.goldSql).every((b) => b.skill === "refusal")).toBe(true);
  });
  for (const item of BENCHMARK.filter((b) => b.goldSql)) {
    it(`${item.id} passes the guard and returns the pinned answer`, async () => {
      const r = await runGuardedQuery(item.goldSql!);
      expect(r.verdict).toBe("allowed");
      expect(r.rows).toEqual(EXPECTED[item.id]);
      // the gold result matches itself under the scorer
      expect(resultsMatch(r, r).match).toBe(true);
    });
  }
});

describe("execution-match scorer", () => {
  const gold = { columns: ["lga_name", "total"], rows: [["Melbourne (C)", 26694]] };
  it("ignores column names and order, and allows extra columns", () => {
    expect(
      resultsMatch(gold, { columns: ["n", "name", "rank"], rows: [[26694, "melbourne (c)", 1]] }).match,
    ).toBe(true);
  });
  it("ignores row order but not row count", () => {
    const g = { columns: ["x"], rows: [["a"], ["b"]] };
    expect(resultsMatch(g, { columns: ["y"], rows: [["b"], ["a"]] }).match).toBe(true);
    expect(resultsMatch(g, { columns: ["y"], rows: [["a"], ["b"], ["c"]] }).reason).toMatch(/2 row/);
  });
  it("requires exact integers but tolerates rounding of decimals", () => {
    expect(cellsEqual(72, 73)).toBe(false);
    expect(cellsEqual(72, "72")).toBe(true);
    expect(cellsEqual(5.4893, 5.49)).toBe(true);
    expect(cellsEqual(0.2493, 0.26)).toBe(false);
    expect(cellsEqual(0.2493, 24.93)).toBe(false);
    expect(cellsEqual(0.24926949876376714, 0.2493)).toBe(true);
    expect(cellsEqual(null, 0)).toBe(false);
  });
  it("fails when a gold column is missing", () => {
    expect(resultsMatch(gold, { columns: ["total"], rows: [[26694]] }).match).toBe(false);
  });
});
