/**
 * Special functions behind the p-values and confidence intervals: log-gamma,
 * the regularised incomplete beta and gamma functions, and the normal and
 * Student t distributions built on them. Accuracy is checked against scipy in
 * `stats-parity.test.ts` (fixture written by scripts/verify_stats.py).
 */

/** Godfrey's Lanczos coefficients (g = 607/128, 15 terms). */
const LANCZOS_G = 607 / 128;
const LANCZOS = [
  0.99999999999999709182, 57.156235665862923517, -59.597960355475491248, 14.136097974741747174,
  -0.49191381609762019978, 0.33994649984811888699e-4, 0.46523628927048575665e-4, -0.98374475304879564677e-4,
  0.15808870322491248884e-3, -0.21026444172410488319e-3, 0.2174396181152126432e-3, -0.16431810653676389022e-3,
  0.84418223983852743293e-4, -0.2619083840158140867e-4, 0.36899182659531622704e-5,
];

/**
 * Log-gamma, accurate to ~1e-15 for x > 0. (The revival's first version used
 * the 9-term g = 7 set, which is only good to ~1e-8; enough for the
 * correlation p-values but not for exact binomial tails.)
 */
export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const xx = x - 1;
  let a = LANCZOS[0];
  const t = xx + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

const FPMIN = 1e-300;

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 500;
  const EPS = 1e-16;
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

/** Regularised upper incomplete gamma Q(a, x) (series or continued fraction). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  const gln = lgamma(a);
  if (x < a + 1) {
    // series for P(a, x)
    let ap = a;
    let del = 1 / a;
    let sum = del;
    for (let n = 0; n < 1000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-17) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  // continued fraction for Q(a, x) (modified Lentz)
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-17) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** Complementary error function, erfc(z) = Q(1/2, z^2) for z >= 0. */
export function erfc(z: number): number {
  if (Number.isNaN(z)) return NaN;
  return z >= 0 ? gammaQ(0.5, z * z) : 2 - gammaQ(0.5, z * z);
}

/** Standard normal CDF. */
export function normalCdf(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

/** Upper tail of the standard normal, accurate far into the tail. */
export function normalSf(x: number): number {
  return 0.5 * erfc(x / Math.SQRT2);
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/**
 * Standard normal quantile: Acklam's rational approximation refined with two
 * Halley steps against `normalCdf` (close to double precision).
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    return NaN;
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  let x: number;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - plow) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  for (let i = 0; i < 2; i++) {
    // work in the smaller tail so the residual keeps its precision
    const e = p < 0.5 ? normalCdf(x) - p : 1 - p - normalSf(x);
    const u = e * SQRT_2PI * Math.exp((x * x) / 2);
    x = x - u / (1 + (x * u) / 2);
  }
  return x;
}

/** Two-sided p-value of Student's t with `df` degrees of freedom. */
export function tTestTwoSided(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Student t CDF. */
export function studentTCdf(t: number, df: number): number {
  const tail = incompleteBeta(df / (df + t * t), df / 2, 0.5) / 2;
  return t >= 0 ? 1 - tail : tail;
}

/** Student t quantile by bisection on the CDF (to ~1e-12). */
export function studentTQuantile(p: number, df: number): number {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  if (p === 0.5) return 0;
  let lo = -1;
  let hi = 1;
  while (studentTCdf(lo, df) > p) lo *= 2;
  while (studentTCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-13 * Math.max(1, Math.abs(lo)); i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
