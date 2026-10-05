import { studentTQuantile } from "./special";

/**
 * Small-area reliability of regional average sentiment. Each region carries
 * the CouchDB `_stats` reduce of its tweets' 1-9 scores (count, sum, sum of
 * squares), so its mean, standard deviation and standard error can be
 * recovered exactly.
 *
 * Caveat built into every number here: tweets are treated as independent
 * draws. Prolific accounts and repeated posts make the effective sample
 * smaller, so these standard errors are lower bounds.
 */

export interface AreaSums {
  n: number;
  sum: number;
  sumsq: number;
}

export interface AreaMean {
  n: number;
  mean: number;
  /** sample SD (n - 1); null below 2 tweets */
  sd: number | null;
  se: number | null;
  /** t-based 95% interval for the mean; null below 2 tweets */
  lower: number | null;
  upper: number | null;
}

export function areaMean({ n, sum, sumsq }: AreaSums, level = 0.95): AreaMean {
  const mean = sum / n;
  if (n < 2) return { n, mean, sd: null, se: null, lower: null, upper: null };
  const variance = Math.max(0, (sumsq - (sum * sum) / n) / (n - 1));
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const t = studentTQuantile(1 - (1 - level) / 2, n - 1);
  return { n, mean, sd, se, lower: mean - t * se, upper: mean + t * se };
}

/**
 * Count, sum and sum of squares of 1-9 scores recovered exactly from a
 * histogram (`counts[i]` posts scored `i + 1`), for `areaMean`.
 */
export function histogramSums(counts: readonly number[]): AreaSums {
  let n = 0;
  let sum = 0;
  let sumsq = 0;
  counts.forEach((c, i) => {
    n += c;
    sum += c * (i + 1);
    sumsq += c * (i + 1) ** 2;
  });
  return { n, sum, sumsq };
}

export interface VarianceComponents {
  /** regions with at least 2 tweets */
  k: number;
  /** pooled within-region variance of individual scores */
  withinVar: number;
  /** method-of-moments between-region variance of the true regional means */
  betweenVar: number;
  /** Cochran's Q */
  q: number;
}

/**
 * Split the spread of regional averages into sampling noise and real
 * between-region differences (a DerSimonian-Laird style moment estimator
 * with a pooled within-region variance).
 */
export function varianceComponents(areas: AreaSums[]): VarianceComponents {
  const ok = areas.filter((a) => a.n >= 2);
  let ss = 0;
  let df = 0;
  for (const a of ok) {
    ss += Math.max(0, a.sumsq - (a.sum * a.sum) / a.n);
    df += a.n - 1;
  }
  const withinVar = ss / df;
  let sw = 0;
  let sw2 = 0;
  let swy = 0;
  for (const a of ok) {
    const w = a.n / withinVar;
    sw += w;
    sw2 += w * w;
    swy += w * (a.sum / a.n);
  }
  const ybar = swy / sw;
  let q = 0;
  for (const a of ok) q += (a.n / withinVar) * (a.sum / a.n - ybar) ** 2;
  const betweenVar = Math.max(0, (q - (ok.length - 1)) / (sw - sw2 / sw));
  return { k: ok.length, withinVar, betweenVar, q };
}

/**
 * Reliability of one region's average: the share of its variance that is
 * real between-region signal rather than sampling noise.
 */
export function reliability(n: number, vc: Pick<VarianceComponents, "withinVar" | "betweenVar">): number {
  if (vc.betweenVar <= 0) return 0;
  return vc.betweenVar / (vc.betweenVar + vc.withinVar / n);
}

/** Tweets a region needs for its average to reach reliability `r`. */
export function tweetsForReliability(
  r: number,
  vc: Pick<VarianceComponents, "withinVar" | "betweenVar">,
): number {
  if (vc.betweenVar <= 0) return Infinity;
  return (r / (1 - r)) * (vc.withinVar / vc.betweenVar);
}

/**
 * The small-area rule (docs/decisions/DR-003): averages built on fewer than
 * this many tweets are suppressed from the spatial statistics and flagged in
 * the scenario explorers.
 */
export const MIN_TWEETS_RELIABLE = 30;
