/**
 * Correlation and regression used by the scenario pages. Mirrors
 * scipy.stats.pearsonr, spearmanr and linregress (two-sided p-values), which
 * scripts/build_analytics.py uses to precompute the stored values; the parity
 * test compares both.
 */

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

/** Log-gamma (Lanczos, g=7, n=9), accurate to ~1e-15 for x > 0. */
function lgamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const xx = x - 1;
  let a = c[0];
  const t = xx + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 500;
  const EPS = 1e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Student's t with `df` degrees of freedom. */
export function tTestTwoSided(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

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
