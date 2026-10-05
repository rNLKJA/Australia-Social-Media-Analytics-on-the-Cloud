export type Scale = ((v: number) => number) & { domain: [number, number]; range: [number, number] };

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = ((v: number) => r0 + (v - d0) * k) as Scale;
  f.domain = domain;
  f.range = range;
  return f;
}

export function logScale(domain: [number, number], range: [number, number]): Scale {
  const l0 = Math.log10(domain[0]);
  const l1 = Math.log10(domain[1]);
  const lin = linearScale([l0, l1], range);
  const f = ((v: number) => lin(Math.log10(Math.max(v, domain[0])))) as Scale;
  f.domain = domain;
  f.range = range;
  return f;
}

/** "Nice" tick values (1, 2, 5 x 10^k steps) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(step0));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

/**
 * Powers of ten times each mantissa (default 1, 2, 5) inside [min, max] for
 * log axes. Narrow charts pass fewer mantissas, e.g. [1, 3] or [1].
 */
export function logTicks(min: number, max: number, mantissas: readonly number[] = [1, 2, 5]): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of mantissas) {
      const v = m * 10 ** e;
      if (v >= min && v <= max) out.push(v);
    }
  }
  return out;
}

/**
 * Label every n-th of a set of evenly spaced ticks so that labels at least
 * `minGap` px apart never collide (1 = label every tick).
 */
export function labelEvery(spacing: number, minGap: number): number {
  if (!(spacing > 0)) return 1;
  return Math.max(1, Math.ceil(minGap / spacing - 1e-9));
}

export function extent(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}
