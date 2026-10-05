import { lgamma, normalQuantile } from "./special";

/**
 * Benjamini-Hochberg adjusted p-values (statsmodels `multipletests(method=
 * "fdr_bh")`). A region is a discovery at false discovery rate q when its
 * adjusted p-value is below q.
 */
export function benjaminiHochberg(pvalues: number[]): number[] {
  const m = pvalues.length;
  const order = pvalues.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const adj = new Array<number>(m);
  let running = 1;
  for (let r = m - 1; r >= 0; r--) {
    const [p, i] = order[r];
    running = Math.min(running, (p * m) / (r + 1));
    adj[i] = Math.min(1, running);
  }
  return adj;
}

/** P(X <= k) for X ~ Binomial(n, 1/2), summed in log space. */
function binomHalfCdf(k: number, n: number): number {
  let s = 0;
  const lnHalfN = n * Math.log(0.5);
  for (let i = 0; i <= k; i++) {
    s += Math.exp(lgamma(n + 1) - lgamma(i + 1) - lgamma(n - i + 1) + lnHalfN);
  }
  return Math.min(1, s);
}

export interface McNemarResult {
  /** pairs where only A was correct */
  b: number;
  /** pairs where only B was correct */
  c: number;
  /** exact two-sided p-value */
  p: number;
}

/**
 * Exact McNemar test on the discordant pairs of a paired comparison
 * (statsmodels `mcnemar(table, exact=True)`): p = min(1, 2 * P(X <= min(b, c)))
 * with X ~ Binomial(b + c, 1/2).
 */
export function mcnemarExact(b: number, c: number): McNemarResult {
  const n = b + c;
  if (n === 0) return { b, c, p: 1 };
  return { b, c, p: Math.min(1, 2 * binomHalfCdf(Math.min(b, c), n)) };
}

export interface PairedDifferenceInterval {
  /** pairs where only A was a success */
  b: number;
  /** pairs where only B was a success */
  c: number;
  /** all pairs */
  n: number;
  /** p_A - p_B = (b - c) / n */
  estimate: number;
  lower: number;
  upper: number;
  level: number;
}

/**
 * Tango's score interval for the difference of two paired proportions,
 * p_A - p_B = (b - c) / n, where b and c are the discordant counts (only A
 * right, only B right) among n pairs. It inverts the score test with the
 * restricted maximum-likelihood estimate of the "only B" cell (Tango 1998,
 * Statistics in Medicine 17:891), stays inside [-1, 1] and behaves when b or
 * c is zero, unlike the Wald interval. Matches R `PropCIs::scoreci.mp(c, b,
 * n)` (verified by scripts/verify_paired_diff.R), solved here by bisection to
 * machine precision rather than PropCIs' 1e-7 stopping rule.
 */
export function pairedDifferenceScoreCi(
  b: number,
  c: number,
  n: number,
  level = 0.95,
): PairedDifferenceInterval {
  const nan = { b, c, n, estimate: NaN, lower: NaN, upper: NaN, level };
  if (!(n > 0) || b < 0 || c < 0 || b + c > n) return nan;
  const z = normalQuantile(1 - (1 - level) / 2);
  const estimate = (b - c) / n;
  // score statistic for H0: p_A - p_B = d; decreasing in d
  const score = (d: number) => {
    const A = 2 * n;
    const B = -b - c + (2 * n - b + c) * d;
    const C = -c * d * (1 - d);
    const q21 = (Math.sqrt(B * B - 4 * A * C) - B) / (2 * A);
    return (b - c - n * d) / Math.sqrt(n * (2 * q21 + d * (1 - d)));
  };
  // the bound is where |score| reaches z; bisect between the estimate and the edge
  const solve = (from: number, edge: number, target: number) => {
    let inside = from;
    let outside = edge;
    for (let i = 0; i < 200; i++) {
      const mid = (inside + outside) / 2;
      if (mid === inside || mid === outside) break;
      const s = score(mid);
      if (Number.isFinite(s) && (target < 0 ? s > target : s < target)) inside = mid;
      else outside = mid;
    }
    return inside;
  };
  const upper = b === n ? 1 : solve(estimate, 1, -z);
  const lower = c === n ? -1 : solve(estimate, -1, z);
  return { b, c, n, estimate, lower, upper, level };
}
