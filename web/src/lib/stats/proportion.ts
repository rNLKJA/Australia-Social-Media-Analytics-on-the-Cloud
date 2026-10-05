import { normalQuantile } from "./special";

export interface ProportionInterval {
  /** successes */
  k: number;
  /** trials */
  n: number;
  estimate: number;
  lower: number;
  upper: number;
  level: number;
}

/**
 * Wilson score interval for a binomial proportion (statsmodels
 * `proportion_confint(method="wilson")`). Unlike the Wald interval it stays
 * inside [0, 1] and behaves at k = 0 or k = n, which matters for small
 * benchmark runs.
 */
export function wilson(k: number, n: number, level = 0.95): ProportionInterval {
  if (n <= 0 || k < 0 || k > n) return { k, n, estimate: NaN, lower: NaN, upper: NaN, level };
  const z = normalQuantile(1 - (1 - level) / 2);
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    k,
    n,
    estimate: p,
    lower: Math.max(0, centre - half),
    upper: Math.min(1, centre + half),
    level,
  };
}
