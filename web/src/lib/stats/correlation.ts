/**
 * Correlation and regression used by the scenario pages. Mirrors
 * scipy.stats.pearsonr, spearmanr and linregress (two-sided p-values), which
 * scripts/build_analytics.py uses to precompute the stored values; the parity
 * test compares both.
 */

import { tTestTwoSided } from "./special";

export interface Correlation {
  n: number;
  pearsonR: number;
  pearsonP: number;
  spearmanRho: number;
  spearmanP: number;
  slope: number;
  intercept: number;
  r2: number;
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export { incompleteBeta, tTestTwoSided } from "./special";

/** p-value for a correlation coefficient r with n observations (scipy's beta form). */
export function correlationPValue(r: number, n: number): number {
  if (n < 3) return NaN;
  const ar = Math.min(Math.abs(r), 1);
  if (ar === 1) return 0;
  const df = n - 2;
  const t = ar * Math.sqrt(df / ((1 + ar) * (1 - ar)));
  return tTestTwoSided(t, df);
}

export function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const r = sxy / Math.sqrt(sxx * syy);
  return Math.max(-1, Math.min(1, r));
}

/** Average ranks (ties share the mean rank), 1-based, like scipy.stats.rankdata. */
export function rankdata(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = r;
    i = j + 1;
  }
  return ranks;
}

export function linregress(xs: number[], ys: number[]): { slope: number; intercept: number; r: number } {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const slope = sxy / sxx;
  const r = syy === 0 || sxx === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  return { slope, intercept: my - slope * mx, r: Math.max(-1, Math.min(1, r)) };
}

export function correlate(xs: number[], ys: number[]): Correlation | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const pearsonR = pearson(xs, ys);
  const spearmanRho = pearson(rankdata(xs), rankdata(ys));
  const lr = linregress(xs, ys);
  return {
    n,
    pearsonR,
    pearsonP: correlationPValue(pearsonR, n),
    spearmanRho,
    spearmanP: correlationPValue(spearmanRho, n),
    slope: lr.slope,
    intercept: lr.intercept,
    r2: lr.r * lr.r,
  };
}

/** Plain-language strength label for |r| (used in annotations only). */
export function describeStrength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.1) return "no meaningful";
  if (a < 0.3) return "a weak";
  if (a < 0.5) return "a moderate";
  return "a strong";
}
