import { normalQuantile, normalSf, tTestTwoSided } from "./special";

/**
 * Ordinary least squares with classical and heteroskedasticity-robust
 * (HC0, HC1, HC3) standard errors, matching statsmodels `OLS(...).fit()` and
 * `.fit(cov_type="HC3")`. Regional averages built on very different numbers
 * of tweets have very different noise, so the classical constant-variance
 * assumption is not credible here; HC3 is the headline.
 */

export interface OlsResult {
  n: number;
  /** parameters including the intercept */
  k: number;
  names: string[];
  coef: number[];
  /** classical standard errors */
  se: number[];
  seHC0: number[];
  seHC1: number[];
  seHC3: number[];
  /** classical t-test p-values (df = n - k) */
  pClassical: number[];
  /** HC3 p-values with the normal reference (statsmodels' default for robust covariance) */
  pHC3: number[];
  /** HC3 95% intervals, normal reference */
  ciHC3: [number, number][];
  r2: number;
  adjR2: number;
  residuals: number[];
  fitted: number[];
}

/** Invert a small symmetric positive-definite matrix (Gauss-Jordan, partial pivoting). */
export function invert(m: number[][]): number[][] {
  const k = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-300) throw new Error("singular matrix");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    for (let j = 0; j < 2 * k; j++) a[col][j] /= p;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * k; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row.slice(k));
}

/**
 * Fit y = b0 + b1 x1 + ... by least squares. `columns` are the regressors
 * (one array per variable); an intercept is added first.
 */
export function ols(columns: number[][], y: number[], names: string[] = []): OlsResult | null {
  const n = y.length;
  const k = columns.length + 1;
  if (n <= k) return null;
  const X: number[][] = Array.from({ length: n }, (_, i) => [1, ...columns.map((c) => c[i])]);
  const xtx = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = X[i];
    for (let a = 0; a < k; a++) {
      xty[a] += xi[a] * y[i];
      for (let b = 0; b < k; b++) xtx[a][b] += xi[a] * xi[b];
    }
  }
  let inv: number[][];
  try {
    inv = invert(xtx);
  } catch {
    return null;
  }
  const coef = inv.map((row) => row.reduce((s, v, j) => s + v * xty[j], 0));
  const fitted = X.map((xi) => xi.reduce((s, v, j) => s + v * coef[j], 0));
  const residuals = y.map((v, i) => v - fitted[i]);
  const ssr = residuals.reduce((s, e) => s + e * e, 0);
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const sigma2 = ssr / (n - k);
  const se = inv.map((row, j) => Math.sqrt(sigma2 * row[j]));

  // sandwich: inv * (sum_i w_i x_i x_i') * inv
  const sandwich = (weights: number[]) => {
    const meat = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) meat[a][b] += weights[i] * xi[a] * xi[b];
    }
    const left = inv.map((row) => meat[0].map((_, b) => row.reduce((s, v, j) => s + v * meat[j][b], 0)));
    const cov = left.map((row) => inv[0].map((_, b) => row.reduce((s, v, j) => s + v * inv[j][b], 0)));
    return cov.map((row, j) => Math.sqrt(row[j]));
  };
  const leverage = X.map((xi) => {
    let h = 0;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) h += xi[a] * inv[a][b] * xi[b];
    return h;
  });
  const e2 = residuals.map((e) => e * e);
  const seHC0 = sandwich(e2);
  const seHC1 = seHC0.map((s) => s * Math.sqrt(n / (n - k)));
  const seHC3 = sandwich(e2.map((v, i) => v / (1 - leverage[i]) ** 2));
  const z = normalQuantile(0.975);
  return {
    n,
    k,
    names: ["intercept", ...columns.map((_, j) => names[j] ?? `x${j + 1}`)],
    coef,
    se,
    seHC0,
    seHC1,
    seHC3,
    pClassical: coef.map((b, j) => tTestTwoSided(b / se[j], n - k)),
    pHC3: coef.map((b, j) => 2 * normalSf(Math.abs(b / seHC3[j]))),
    ciHC3: coef.map((b, j) => [b - z * seHC3[j], b + z * seHC3[j]] as [number, number]),
    r2: 1 - ssr / sst,
    adjR2: 1 - ssr / (n - k) / (sst / (n - 1)),
    residuals,
    fitted,
  };
}
