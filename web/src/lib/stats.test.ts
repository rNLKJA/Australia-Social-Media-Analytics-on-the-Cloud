import { describe, expect, it } from "vitest";
import fx from "@/lib/__fixtures__/correlations-parity.json";
import { correlate, correlationPValue, rankdata } from "./stats";

type Row = [string, number, number | null, number, number | null, number];

/**
 * scripts/build_analytics.py computes every stored correlation with
 * scipy.stats (pearsonr, spearmanr, linregress). The browser recomputes them
 * when the reader changes the minimum-tweet threshold, so the TS port must
 * agree with scipy on the same inputs.
 */
function subset(rows: Row[], yIdx: number, wIdx: number, k: number) {
  const r = rows.filter((row) => (row[wIdx] as number) >= k && row[1] != null && row[yIdx] != null);
  return { x: r.map((row) => row[1] as number), y: r.map((row) => row[yIdx] as number) };
}

const cases: {
  scenario: string;
  unit: string;
  y: string;
  pick: (k: number) => { x: number[]; y: number[] };
}[] = [
  { scenario: "income", unit: "sa2", y: "avg_income", pick: (k) => subset(fx.income as Row[], 2, 3, k) },
  { scenario: "income", unit: "sa2", y: "avg_all", pick: (k) => subset(fx.income as Row[], 4, 5, k) },
  { scenario: "crime", unit: "lga", y: "avg_crime", pick: (k) => subset(fx.crime as Row[], 2, 3, k) },
  { scenario: "crime", unit: "lga", y: "avg_all", pick: (k) => subset(fx.crime as Row[], 4, 5, k) },
  {
    scenario: "crime",
    unit: "sal",
    y: "avg_raw",
    pick: (k) => {
      const r = (fx.crimeSal as [string, number, number, number][]).filter((row) => row[3] >= k);
      return { x: r.map((row) => row[1]), y: r.map((row) => row[2]) };
    },
  },
];

describe("scipy parity (pearsonr / spearmanr / linregress)", () => {
  for (const exp of fx.expected) {
    const c = cases.find(
      (cc) => cc.scenario === exp.scenario && cc.unit === exp.unit && cc.y === exp.y_metric,
    )!;
    it(`${exp.scenario}/${exp.unit} ${exp.y_metric} min_tweets>=${exp.min_tweets}`, () => {
      const { x, y } = c.pick(exp.min_tweets);
      const got = correlate(x, y)!;
      expect(got.n).toBe(exp.n);
      expect(got.pearsonR).toBeCloseTo(exp.pearson_r, 10);
      expect(got.spearmanRho).toBeCloseTo(exp.spearman_rho, 10);
      expect(got.pearsonP).toBeCloseTo(exp.pearson_p, 8);
      expect(got.spearmanP).toBeCloseTo(exp.spearman_p, 8);
      expect(got.slope / exp.slope).toBeCloseTo(1, 9);
      expect(got.intercept).toBeCloseTo(exp.intercept, 8);
      expect(got.r2).toBeCloseTo(exp.r2, 10);
    });
  }
});

describe("helpers", () => {
  it("averages tied ranks like scipy.stats.rankdata", () => {
    expect(rankdata([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]);
  });
  it("gives p = 1 for r = 0 and p = 0 for |r| = 1", () => {
    expect(correlationPValue(0, 10)).toBeCloseTo(1, 12);
    expect(correlationPValue(1, 10)).toBe(0);
  });
});
