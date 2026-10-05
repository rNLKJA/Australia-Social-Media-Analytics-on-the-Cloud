import { pearson, rankdata } from "./correlation";
import { createRng, DEFAULT_SEED } from "./random";

export interface BootstrapOptions {
  /** resamples (default 2000) */
  B?: number;
  seed?: number;
  /** confidence level (default 0.95) */
  level?: number;
}

export interface BootstrapInterval {
  estimate: number;
  lower: number;
  upper: number;
  /** resamples that produced a finite statistic */
  B: number;
  /** resamples dropped because the statistic was undefined (e.g. no variance) */
  dropped: number;
  seed: number;
  level: number;
  n: number;
}

/** numpy.percentile's default (linear interpolation) on sorted data. */
export function quantileSorted(sorted: ArrayLike<number>, p: number): number {
  const m = sorted.length;
  if (!m) return NaN;
  const pos = (m - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.min(m - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Percentile bootstrap: resample the n units with replacement B times,
 * recompute `stat` on each resample and take the (1-level)/2 and
 * (1+level)/2 quantiles. `stat` receives the resampled unit indices.
 */
export function bootstrapCI(
  n: number,
  stat: (idx: Int32Array) => number,
  { B = 2000, seed = DEFAULT_SEED, level = 0.95 }: BootstrapOptions = {},
): BootstrapInterval {
  const all = new Int32Array(n);
  for (let i = 0; i < n; i++) all[i] = i;
  const estimate = stat(all);
  const rng = createRng(seed);
  const draws = new Float64Array(B);
  const idx = new Int32Array(n);
  let kept = 0;
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) idx[i] = rng.int(n);
    const v = stat(idx);
    if (Number.isFinite(v)) draws[kept++] = v;
  }
  const sorted = draws.slice(0, kept).sort();
  const alpha = (1 - level) / 2;
  return {
    estimate,
    lower: quantileSorted(sorted, alpha),
    upper: quantileSorted(sorted, 1 - alpha),
    B: kept,
    dropped: B - kept,
    seed,
    level,
    n,
  };
}

/** Spearman's rho with a paired percentile-bootstrap interval. */
export function spearmanBootstrap(
  xs: number[],
  ys: number[],
  opts: BootstrapOptions = {},
): BootstrapInterval {
  const n = xs.length;
  const bx = new Array<number>(n);
  const by = new Array<number>(n);
  return bootstrapCI(
    n,
    (idx) => {
      for (let i = 0; i < idx.length; i++) {
        bx[i] = xs[idx[i]];
        by[i] = ys[idx[i]];
      }
      const rx = rankdata(bx);
      const ry = rankdata(by);
      const r = pearson(rx, ry);
      return Number.isFinite(r) ? r : NaN;
    },
    opts,
  );
}

/** Bootstrap interval for a mean (used for latency summaries). */
export function meanBootstrap(xs: number[], opts: BootstrapOptions = {}): BootstrapInterval {
  return bootstrapCI(
    xs.length,
    (idx) => {
      let s = 0;
      for (let i = 0; i < idx.length; i++) s += xs[idx[i]];
      return s / idx.length;
    },
    opts,
  );
}

/** Bootstrap interval for a median. */
export function medianBootstrap(xs: number[], opts: BootstrapOptions = {}): BootstrapInterval {
  const buf = new Float64Array(xs.length);
  return bootstrapCI(
    xs.length,
    (idx) => {
      for (let i = 0; i < idx.length; i++) buf[i] = xs[idx[i]];
      buf.sort();
      return quantileSorted(buf, 0.5);
    },
    opts,
  );
}
