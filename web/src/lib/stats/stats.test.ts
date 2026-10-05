import { describe, expect, it } from "vitest";
import { bootstrapCI, meanBootstrap, medianBootstrap, quantileSorted, spearmanBootstrap } from "./bootstrap";
import { benjaminiHochberg, mcnemarExact } from "./multiple";
import { wilson } from "./proportion";
import { createRng, shuffleInPlace } from "./random";
import { invert, ols } from "./regression";
import { areaMean, reliability, tweetsForReliability, varianceComponents } from "./reliability";
import {
  inducedSubgraph,
  knnNeighbors,
  lisaClusters,
  localMoran,
  moran,
  rowStandardise,
  withoutIslands,
} from "./spatial";

describe("seeded random numbers", () => {
  it("repeats exactly for a seed and differs across seeds", () => {
    const a = createRng(57);
    const b = createRng(57);
    const c = createRng(58);
    const xa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(xa);
    for (const v of xa) expect(v >= 0 && v < 1).toBe(true);
  });
  it("is roughly uniform", () => {
    const r = createRng(1);
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 100000; i++) bins[r.int(10)]++;
    for (const b of bins) expect(Math.abs(b - 10000)).toBeLessThan(500);
  });
  it("shuffles into a permutation", () => {
    const xs = Array.from({ length: 50 }, (_, i) => i);
    shuffleInPlace(xs, createRng(3));
    expect([...xs].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(xs).not.toEqual(Array.from({ length: 50 }, (_, i) => i));
  });
});

describe("bootstrap", () => {
  it("interpolates quantiles like numpy.percentile", () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4], 0.025)).toBeCloseTo(1.075, 12);
    expect(quantileSorted([7], 0.9)).toBe(7);
  });
  it("is reproducible for a seed and brackets the estimate", () => {
    const xs = Array.from({ length: 80 }, (_, i) => Math.sin(i) * 3 + i / 10);
    const a = meanBootstrap(xs, { B: 500, seed: 9 });
    const b = meanBootstrap(xs, { B: 500, seed: 9 });
    expect(a).toEqual(b);
    expect(a.lower).toBeLessThan(a.estimate);
    expect(a.upper).toBeGreaterThan(a.estimate);
    expect(a.B).toBe(500);
  });
  it("narrows as the sample grows", () => {
    const gen = (n: number) => Array.from({ length: n }, (_, i) => ((i * 7919) % 101) / 10);
    const small = meanBootstrap(gen(30), { B: 800 });
    const large = meanBootstrap(gen(600), { B: 800 });
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
  });
  it("drops undefined resamples instead of returning NaN", () => {
    // a constant x has no ranks to correlate, so every resample is undefined
    const res = spearmanBootstrap([1, 1, 1, 1, 1], [1, 2, 3, 4, 5], { B: 50 });
    expect(res.B).toBe(0);
    expect(res.dropped).toBe(50);
  });
  it("covers a perfectly monotone relationship at rho = 1", () => {
    const xs = Array.from({ length: 40 }, (_, i) => i);
    const res = spearmanBootstrap(
      xs,
      xs.map((x) => x * x),
      { B: 300 },
    );
    expect(res.estimate).toBeCloseTo(1, 12);
    expect(res.lower).toBeCloseTo(1, 12);
  });
  it("supports any statistic of the resampled indices", () => {
    const xs = [3, 1, 4, 1, 5, 9, 2, 6];
    const r = bootstrapCI(xs.length, (idx) => Math.max(...Array.from(idx, (i) => xs[i])), { B: 200 });
    expect(r.estimate).toBe(9);
    expect(r.upper).toBe(9);
    expect(medianBootstrap(xs, { B: 200 }).estimate).toBe(3.5);
  });
});

describe("Wilson interval", () => {
  it("handles 0/n and n/n without leaving [0, 1]", () => {
    const zero = wilson(0, 15);
    expect(zero.lower).toBe(0);
    expect(zero.upper).toBeGreaterThan(0.15);
    const all = wilson(15, 15);
    expect(all.upper).toBe(1);
    expect(all.lower).toBeLessThan(0.85);
  });
  it("returns NaN for an empty sample", () => {
    expect(Number.isNaN(wilson(0, 0).estimate)).toBe(true);
  });
});

describe("multiple testing and paired comparisons", () => {
  it("BH adjustment is monotone in the raw p-values and never below them", () => {
    const p = [0.01, 0.04, 0.03, 0.2, 0.005];
    const adj = benjaminiHochberg(p);
    p.forEach((v, i) => expect(adj[i]).toBeGreaterThanOrEqual(v));
    const order = p.map((v, i) => [v, adj[i]]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < order.length; i++) expect(order[i][1]).toBeGreaterThanOrEqual(order[i - 1][1]);
  });
  it("McNemar is symmetric and 1 without discordant pairs", () => {
    expect(mcnemarExact(0, 0).p).toBe(1);
    expect(mcnemarExact(2, 9).p).toBeCloseTo(mcnemarExact(9, 2).p, 15);
    expect(mcnemarExact(0, 6).p).toBeCloseTo(2 / 64, 15);
  });
});

describe("OLS", () => {
  it("recovers an exact line", () => {
    const x = [1, 2, 3, 4, 5, 6];
    const r = ols(
      [x],
      x.map((v) => 2 + 0.5 * v),
    )!;
    expect(r.coef[0]).toBeCloseTo(2, 12);
    expect(r.coef[1]).toBeCloseTo(0.5, 12);
    expect(r.r2).toBeCloseTo(1, 12);
  });
  it("returns null when there are no residual degrees of freedom", () => {
    expect(ols([[1, 2]], [3, 4])).toBeNull();
  });
  it("inverts a matrix", () => {
    const m = [
      [4, 1],
      [1, 3],
    ];
    const inv = invert(m);
    const id = m.map((row) => inv[0].map((_, j) => row.reduce((s, v, k) => s + v * inv[k][j], 0)));
    expect(id[0][0]).toBeCloseTo(1, 14);
    expect(id[0][1]).toBeCloseTo(0, 14);
    expect(id[1][1]).toBeCloseTo(1, 14);
  });
});

describe("small-area reliability", () => {
  it("recovers mean and SD from _stats sums", () => {
    const scores = [5, 7, 3, 9, 5, 6];
    const m = areaMean({
      n: scores.length,
      sum: scores.reduce((a, b) => a + b, 0),
      sumsq: scores.reduce((a, b) => a + b * b, 0),
    });
    expect(m.mean).toBeCloseTo(35 / 6, 12);
    const v = scores.reduce((a, b) => a + (b - 35 / 6) ** 2, 0) / 5;
    expect(m.sd!).toBeCloseTo(Math.sqrt(v), 12);
    expect(m.lower!).toBeLessThan(m.mean);
  });
  it("gives no interval for a single tweet", () => {
    expect(areaMean({ n: 1, sum: 6, sumsq: 36 }).se).toBeNull();
  });
  it("relates reliability and required tweets consistently", () => {
    const vc = { withinVar: 3, betweenVar: 0.04 };
    const n = tweetsForReliability(0.5, vc);
    expect(n).toBeCloseTo(75, 10);
    expect(reliability(n, vc)).toBeCloseTo(0.5, 12);
    expect(reliability(10, { withinVar: 3, betweenVar: 0 })).toBe(0);
  });
  it("finds no between-region variance when regions are identical in expectation", () => {
    const areas = Array.from({ length: 20 }, () => ({ n: 50, sum: 250, sumsq: 50 * 25 + 49 * 2 }));
    expect(varianceComponents(areas).betweenVar).toBe(0);
  });
});

describe("spatial weights and autocorrelation", () => {
  // a 5 x 5 grid with rook neighbours
  const side = 5;
  const grid = Array.from({ length: side * side }, (_, i) => {
    const r = Math.floor(i / side);
    const c = i % side;
    return [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]
      .filter(([a, b]) => a >= 0 && a < side && b >= 0 && b < side)
      .map(([a, b]) => a * side + b);
  });
  const w = rowStandardise(grid);

  it("detects a smooth gradient as positive autocorrelation", () => {
    const y = Array.from({ length: side * side }, (_, i) => Math.floor(i / side) + (i % side));
    const m = moran(y, w, { permutations: 499 });
    expect(m.I).toBeGreaterThan(0.5);
    expect(m.p_sim).toBeLessThan(0.01);
    expect(m.EI).toBeCloseTo(-1 / 24, 15);
  });
  it("detects a checkerboard as negative autocorrelation", () => {
    const y = Array.from({ length: side * side }, (_, i) => (Math.floor(i / side) + (i % side)) % 2);
    const m = moran(y, w, { permutations: 499 });
    expect(m.I).toBeLessThan(-0.9);
  });
  it("labels clusters and gets the same answer for the same seed", () => {
    const y = Array.from({ length: side * side }, (_, i) => (Math.floor(i / side) < 2 ? 9 : 1));
    const a = localMoran(y, w, { permutations: 499, seed: 4 });
    const b = localMoran(y, w, { permutations: 499, seed: 4 });
    expect(a).toEqual(b);
    const labels = lisaClusters(a, { alpha: 0.2 });
    expect(labels.filter((l) => l === "HH").length).toBeGreaterThan(0);
    expect(labels.filter((l) => l === "LL").length).toBeGreaterThan(0);
    expect(labels.every((l) => l !== "HL" && l !== "LH")).toBe(true);
    a.p_two.forEach((p, i) => expect(p).toBeCloseTo(Math.min(1, 2 * a.p_sim[i]), 15));
    // FDR can only remove discoveries
    const fdr = lisaClusters(a, { alpha: 0.2, fdr: true });
    expect(fdr.filter((l) => l !== "ns").length).toBeLessThanOrEqual(labels.filter((l) => l !== "ns").length);
  });
  it("re-indexes an induced subgraph and drops islands", () => {
    const keep = grid.map((_, i) => i !== 1 && i !== 5); // isolates corner 0
    const sub = inducedSubgraph(grid, keep);
    expect(sub.index).not.toContain(1);
    const noIsl = withoutIslands(sub);
    expect(noIsl.islands).toEqual([0]);
    expect(noIsl.neighbors.every((nb) => nb.length > 0)).toBe(true);
  });
  it("finds k nearest neighbours", () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [10, 10],
      [11, 10],
    ];
    const nb = knnNeighbors(pts, 2);
    expect(nb[0]).toEqual([1, 2]);
    expect(nb[3]).toContain(4);
  });
});
