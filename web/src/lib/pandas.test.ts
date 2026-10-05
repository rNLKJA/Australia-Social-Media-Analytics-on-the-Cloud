import { describe, expect, it } from "vitest";
import crime from "@/lib/__fixtures__/crime-lga-parity.json";
import income from "@/lib/__fixtures__/income-vic-parity.json";
import { iqrFilter, npRound, quantile, rint } from "./pandas";

describe("numpy rounding", () => {
  it("rounds half to even on the scaled double", () => {
    expect(rint(2.5)).toBe(2);
    expect(rint(3.5)).toBe(4);
    expect(rint(-2.5)).toBe(-2);
    expect(npRound(5.555, 2)).toBe(5.56); // 555.5000000000001 after scaling
    expect(npRound(1.005, 2)).toBe(1); // 100.49999999999999 after scaling
  });
  it("interpolates quantiles linearly", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
  });
});

describe("drop_outliers parity (app.py visualize_income_data)", () => {
  type Row = [string, number, number, number, number];
  const rows = income.rows as Row[];
  const cols = [
    { key: "mean_aud", get: (r: Row) => r[1] },
    { key: " median_aud", get: (r: Row) => r[2] },
    { key: " sum_aud", get: (r: Row) => r[3] },
  ];
  const { kept, bounds } = iqrFilter(rows, cols);

  it("reproduces the describe().round(2) quartiles", () => {
    for (const c of cols) {
      expect(bounds[c.key].q1).toBe(income.summary[c.key as keyof typeof income.summary]["25%"]);
      expect(bounds[c.key].q3).toBe(income.summary[c.key as keyof typeof income.summary]["75%"]);
    }
  });
  it("keeps 420 of 457 Victorian SA2s (report 6.2.1)", () => {
    expect(rows).toHaveLength(457);
    expect(kept).toHaveLength(income.expected.kept);
  });
  it("finds Merbein (28,996) and Sydenham (62,029) as the extremes", () => {
    const sorted = [...kept].sort((a, b) => a[2] - b[2]);
    expect([sorted[0][0], sorted[0][2]]).toEqual(income.expected.min);
    expect([sorted.at(-1)![0], sorted.at(-1)![2]]).toEqual(income.expected.max);
  });
  it("has a median of ~45.9k AUD after filtering (report: 'above the 45.8k 50th quantile')", () => {
    expect(
      quantile(
        kept.map((r) => r[2]),
        0.5,
      ),
    ).toBe(income.expected.median);
  });
});

describe("drop_outliers parity (app.py visualize_crime_data)", () => {
  type Row = [string, ...number[]];
  const rows = crime.rows as Row[];
  const cols = crime.columns.map((key, i) => ({ key, get: (r: Row) => r[i + 1] as number }));
  const { kept, bounds } = iqrFilter(rows, cols);

  it("reproduces the quartiles", () => {
    for (const c of cols) {
      expect(bounds[c.key].q1).toBe(crime.summary[c.key as keyof typeof crime.summary]["25%"]);
      expect(bounds[c.key].q3).toBe(crime.summary[c.key as keyof typeof crime.summary]["75%"]);
    }
  });
  it("keeps exactly the 72 LGAs drawn on the original crime map", () => {
    expect(rows).toHaveLength(79);
    expect(kept.map((r) => r[0]).sort()).toEqual(crime.expectedKept);
  });
});
