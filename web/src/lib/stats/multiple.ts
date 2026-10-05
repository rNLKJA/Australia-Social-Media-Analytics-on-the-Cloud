import { lgamma } from "./special";

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
