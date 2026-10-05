/**
 * The small slice of pandas/numpy behaviour the original notebooks and Flask
 * app relied on: `Series.round(d)` (numpy rounding), `describe()` quantiles
 * (linear interpolation) and the team's sequential IQR outlier filter
 * (`drop_outliers` in coursework/1_Flask_Backend/flask-backend/app.py).
 */

/** numpy.rint: round half to even on the double value. */
export function rint(y: number): number {
  const f = Math.floor(y);
  const diff = y - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** `np.round(x, d)` / `Series.round(d)`: rint(x * 10**d) / 10**d. */
export function npRound(x: number, d: number): number {
  if (!Number.isFinite(x)) return x;
  const p = 10 ** d;
  return rint(x * p) / p;
}

/** `Series.quantile(q)` with the default linear interpolation, NaNs ignored. */
export function quantile(values: number[], q: number): number {
  const xs = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  if (!xs.length) return NaN;
  const pos = (xs.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  if (lo === hi) return xs[lo];
  // numpy's _lerp: a + (b - a) * t, switching form for t >= 0.5
  const a = xs[lo];
  const b = xs[hi];
  const diff = b - a;
  return frac >= 0.5 ? b - diff * (1 - frac) : a + diff * frac;
}

export function median(values: number[]): number {
  return quantile(values, 0.5);
}

export interface IqrBounds {
  q1: number;
  q3: number;
  lower: number;
  upper: number;
}

/**
 * `drop_outliers(df, columns)`: quartiles come from `describe().round(2)` of
 * the UNFILTERED frame; rows outside [Q1 - 1.5 IQR, Q3 + 1.5 IQR] are dropped
 * column by column, in order.
 */
export function iqrFilter<T>(
  rows: T[],
  columns: { key: string; get: (row: T) => number }[],
): { kept: T[]; bounds: Record<string, IqrBounds> } {
  const bounds: Record<string, IqrBounds> = {};
  for (const c of columns) {
    const vals = rows.map(c.get);
    const q1 = npRound(quantile(vals, 0.25), 2);
    const q3 = npRound(quantile(vals, 0.75), 2);
    const iqr = q3 - q1;
    bounds[c.key] = { q1, q3, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
  }
  let kept = rows;
  for (const c of columns) {
    const { lower, upper } = bounds[c.key];
    kept = kept.filter((r) => {
      const v = c.get(r);
      return !(v < lower || v > upper);
    });
  }
  return { kept, bounds };
}

/** `groupby(key).agg(...)`, preserving pandas' sorted group order. */
export function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return new Map([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
