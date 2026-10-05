import { describe, expect, it } from "vitest";
import { classify, divergingColor, quantileBreaks, sentimentColor } from "./palette";
import { extent, linearScale, logTicks, niceTicks } from "./scales";

describe("scales", () => {
  it("maps linearly", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(2.5)).toBe(25);
  });
  it("produces nice ticks", () => {
    expect(niceTicks(0, 9, 4)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(28996, 62029, 4)).toEqual([30000, 40000, 50000, 60000]);
  });
  it("produces log ticks", () => {
    expect(logTicks(1, 100)).toEqual([1, 2, 5, 10, 20, 50, 100]);
  });
  it("ignores non-finite values in extent", () => {
    expect(extent([3, NaN, 1, Infinity, 2])).toEqual([1, 3]);
  });
});

describe("palette", () => {
  it("anchors sentiment colours at the integer buckets", () => {
    expect(sentimentColor(1)).toBe("#a63a24");
    expect(sentimentColor(5)).toBe("#e4dccd");
    expect(sentimentColor(9)).toBe("#0f625c");
    expect(divergingColor(5, 5, 1.5)).toBe("#e4dccd");
  });
  it("classifies against quantile breaks", () => {
    const b = quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8], 4);
    expect(b).toHaveLength(3);
    expect(classify(1, b)).toBe(0);
    expect(classify(8, b)).toBe(3);
  });
});

describe("format", () => {
  it("never prints a negative zero correlation", async () => {
    const { fmtR } = await import("./format");
    expect(fmtR(-0.0015)).toBe("0.00");
    expect(fmtR(-0.31)).toBe("−0.31");
  });
});
