/**
 * Aggregations from the original Flask backend and notebooks.
 */
import { groupBy, npRound } from "./pandas";

/** A CouchDB `_stats` reduce row for one SAL (group_level=1). */
export interface ReduceRow {
  sal: string;
  sum: number;
  count: number;
}

/**
 * app.py `ready_for_join`: average sentiment per SAL,
 * `(value.sum / value.count).round(2)`.
 */
export function averageSentiment(row: Pick<ReduceRow, "sum" | "count">): number {
  return npRound(row.sum / row.count, 2);
}

/** pandas `groupby().median()` (mean of the two middle values for even n). */
export function groupMedian(values: number[]): number {
  const xs = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const n = xs.length;
  if (!n) return NaN;
  const mid = n >> 1;
  return n % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** Kahan-compensated sum, as pandas' cython groupby sum/mean use. */
export function kahanSum(values: number[]): number {
  let sum = 0;
  let c = 0;
  for (const v of values) {
    const y = v - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  return sum;
}

export interface Sa2IncomeRow {
  gcc: string;
  mean: number;
  median: number;
  sum: number;
  medianAge: number;
}

export interface GccIncome {
  gcc: string;
  meanAud: number;
  medianAud: number;
  sumAud: number;
  medianAge: number;
  sa2Count: number;
}

/**
 * The SUDO summary's Greater Capital City view: SA2 rows grouped by GCC code
 * with mean(mean), median(median), sum(sum) and mean(median age).
 */
export function aggregateByGcc(rows: Sa2IncomeRow[]): GccIncome[] {
  return [...groupBy(rows, (r) => r.gcc)].map(([gcc, g]) => ({
    gcc,
    meanAud: kahanSum(g.map((r) => r.mean)) / g.length,
    medianAud: groupMedian(g.map((r) => r.median)),
    sumAud: kahanSum(g.map((r) => r.sum)),
    medianAge: kahanSum(g.map((r) => r.medianAge)) / g.length,
    sa2Count: g.length,
  }));
}

/**
 * Share of regions by number of topic tweets, as quoted in report 6.2.2/6.3.2
 * ("73% of the regions have only 1-10 tweets ..."). `inclusive` decides
 * whether the 10 and 100 boundaries fall in the lower bin.
 */
export function tweetVolumeShares(counts: number[], inclusive: boolean): [number, number, number] {
  const n = counts.length;
  const low = counts.filter((c) => (inclusive ? c <= 10 : c < 10)).length;
  const high = counts.filter((c) => (inclusive ? c > 100 : c >= 100)).length;
  return [low / n, (n - low - high) / n, high / n];
}
