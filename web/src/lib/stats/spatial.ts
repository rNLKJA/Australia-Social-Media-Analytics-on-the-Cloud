import { benjaminiHochberg } from "./multiple";
import { createRng, DEFAULT_SEED, shuffleInPlace } from "./random";
import { normalSf } from "./special";

/**
 * Spatial autocorrelation: global Moran's I and local Moran (LISA), with
 * the same estimators, variances and permutation p-values as PySAL's
 * `esda.Moran` / `esda.Moran_Local`. Verified against esda in
 * `spatial.test.ts` (fixture from scripts/verify_stats.py).
 */

/** Neighbour lists: neighbors[i] are the indices adjacent to region i. */
export type Neighbors = number[][];

export interface Weights {
  neighbors: Neighbors;
  /** weights[i][t] is the weight of neighbors[i][t] */
  weights: number[][];
}

/** Row-standardised weights (each region's neighbours share a weight of 1). */
export function rowStandardise(neighbors: Neighbors): Weights {
  return { neighbors, weights: neighbors.map((nb) => nb.map(() => 1 / nb.length)) };
}

/** Keep only the regions with `keep[i]`; returns the kept original indices and re-indexed neighbours. */
export function inducedSubgraph(
  neighbors: Neighbors,
  keep: boolean[],
): { index: number[]; neighbors: Neighbors } {
  const index: number[] = [];
  const map = new Int32Array(neighbors.length).fill(-1);
  keep.forEach((k, i) => {
    if (k) {
      map[i] = index.length;
      index.push(i);
    }
  });
  return {
    index,
    neighbors: index.map((i) =>
      neighbors[i]
        .map((j) => map[j])
        .filter((j) => j >= 0)
        .sort((a, b) => a - b),
    ),
  };
}

/**
 * Drop regions without neighbours ("islands": they have no spatial lag),
 * with indices mapped back to the original numbering.
 */
export function withoutIslands(sub: { index: number[]; neighbors: Neighbors }): {
  index: number[];
  neighbors: Neighbors;
  islands: number[];
} {
  const keep = sub.neighbors.map((nb) => nb.length > 0);
  const inner = inducedSubgraph(sub.neighbors, keep);
  return {
    index: inner.index.map((i) => sub.index[i]),
    neighbors: inner.neighbors,
    islands: sub.index.filter((_, i) => !keep[i]),
  };
}

/**
 * Equirectangular projection around latitude `lat0` (degrees), in degree
 * units, so east-west and north-south distances are comparable for k-NN.
 */
export function projectLonLat(lon: number, lat: number, lat0 = -37): [number, number] {
  return [lon * Math.cos((lat0 * Math.PI) / 180), lat];
}

/** k nearest neighbours by Euclidean distance (ties broken by index). */
export function knnNeighbors(points: [number, number][], k: number): Neighbors {
  const n = points.length;
  const kk = Math.min(k, n - 1);
  return points.map(([x, y], i) => {
    const d: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = points[j][0] - x;
      const dy = points[j][1] - y;
      d.push([dx * dx + dy * dy, j]);
    }
    d.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return d
      .slice(0, kk)
      .map(([, j]) => j)
      .sort((a, b) => a - b);
  });
}

function lagOf(z: ArrayLike<number>, w: Weights): Float64Array {
  const n = w.neighbors.length;
  const lag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const nb = w.neighbors[i];
    const wt = w.weights[i];
    let s = 0;
    for (let t = 0; t < nb.length; t++) s += wt[t] * z[nb[t]];
    lag[i] = s;
  }
  return lag;
}

/** Folded pseudo p-value used by esda: (min(#>=, #<) + 1) / (perms + 1). */
function foldedP(sim: ArrayLike<number>, observed: number): number {
  const perms = sim.length;
  let larger = 0;
  for (let i = 0; i < perms; i++) if (sim[i] >= observed) larger++;
  if (perms - larger < larger) larger = perms - larger;
  return (larger + 1) / (perms + 1);
}

export interface MoranResult {
  n: number;
  I: number;
  EI: number;
  VI_norm: number;
  VI_rand: number;
  z_norm: number;
  z_rand: number;
  /** two-sided, normality assumption */
  p_norm: number;
  /** two-sided, randomisation assumption */
  p_rand: number;
  /**
   * permutation pseudo p-value as esda reports it: one-sided, in the direction
   * of the observed I (for I above E[I] this is the test for clustering)
   */
  p_sim: number;
  permutations: number;
  seed: number;
}

export interface PermutationOptions {
  permutations?: number;
  seed?: number;
}

/** Global Moran's I. */
export function moran(
  y: number[],
  w: Weights,
  { permutations = 999, seed = DEFAULT_SEED }: PermutationOptions = {},
): MoranResult {
  const n = y.length;
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const z = Float64Array.from(y, (v) => v - mean);
  let s0 = 0;
  const rowSum = new Float64Array(n);
  const colSum = new Float64Array(n);
  const dense = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    w.neighbors[i].forEach((j, t) => {
      const v = w.weights[i][t];
      s0 += v;
      rowSum[i] += v;
      colSum[j] += v;
      dense[i * n + j] += v;
    });
  }
  let s1 = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const v = dense[i * n + j] + dense[j * n + i];
      if (v) s1 += v * v;
    }
  s1 /= 2;
  let s2 = 0;
  for (let i = 0; i < n; i++) s2 += (rowSum[i] + colSum[i]) ** 2;

  const stat = (zz: ArrayLike<number>) => {
    const lag = lagOf(zz, w);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += zz[i] * lag[i];
      den += zz[i] * zz[i];
    }
    return (n / s0) * (num / den);
  };
  const I = stat(z);
  const EI = -1 / (n - 1);
  const n2 = n * n;
  const s02 = s0 * s0;
  const VI_norm = (n2 * s1 - n * s2 + 3 * s02) / ((n - 1) * (n + 1) * s02) - EI * EI;
  let m2 = 0;
  let m4 = 0;
  for (let i = 0; i < n; i++) {
    m2 += z[i] ** 2;
    m4 += z[i] ** 4;
  }
  const kurt = m4 / n / (m2 / n) ** 2;
  const A = n * ((n2 - 3 * n + 3) * s1 - n * s2 + 3 * s02);
  const B = kurt * ((n2 - n) * s1 - 2 * n * s2 + 6 * s02);
  const VI_rand = (A - B) / ((n - 1) * (n - 2) * (n - 3) * s02) - EI * EI;
  const z_norm = (I - EI) / Math.sqrt(VI_norm);
  const z_rand = (I - EI) / Math.sqrt(VI_rand);

  const rng = createRng(seed);
  const zp = Float64Array.from(z);
  const sim = new Float64Array(permutations);
  for (let p = 0; p < permutations; p++) {
    shuffleInPlace(zp, rng);
    sim[p] = stat(zp);
  }
  return {
    n,
    I,
    EI,
    VI_norm,
    VI_rand,
    z_norm,
    z_rand,
    p_norm: 2 * normalSf(Math.abs(z_norm)),
    p_rand: 2 * normalSf(Math.abs(z_rand)),
    p_sim: permutations ? foldedP(sim, I) : NaN,
    permutations,
    seed,
  };
}

/** 1 = High-High, 2 = Low-High, 3 = Low-Low, 4 = High-Low (esda's numbering). */
export type Quadrant = 1 | 2 | 3 | 4;

export interface LocalMoranResult {
  /** standardised values (population SD) */
  z: number[];
  /** spatial lag of z */
  lag: number[];
  Is: number[];
  q: Quadrant[];
  /**
   * esda's default pseudo p-value ("directed": the tail the observed value
   * falls in). It is one-sided in a data-chosen direction, so it runs about
   * half the two-sided value.
   */
  p_sim: number[];
  /** two-sided pseudo p-value, min(1, 2 * p_sim): the one the site reports */
  p_two: number[];
  permutations: number;
  seed: number;
}

/** Local Moran's I with conditional randomisation (each region's value held fixed). */
export function localMoran(
  y: number[],
  w: Weights,
  { permutations = 999, seed = DEFAULT_SEED }: PermutationOptions = {},
): LocalMoranResult {
  const n = y.length;
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(y.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const z = y.map((v) => (v - mean) / sd);
  const den = z.reduce((a, b) => a + b * b, 0);
  const lag = Array.from(lagOf(z, w));
  const Is = z.map((zi, i) => ((n - 1) * zi * lag[i]) / den);
  const q = z.map((zi, i): Quadrant => (zi > 0 ? (lag[i] > 0 ? 1 : 4) : lag[i] > 0 ? 2 : 3));

  const rng = createRng(seed);
  const pool = new Int32Array(n - 1);
  const sim = new Float64Array(permutations);
  const p_sim = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < n - 1; r++) pool[r] = r < i ? r : r + 1;
    const nb = w.neighbors[i];
    const wt = w.weights[i];
    const k = nb.length;
    for (let p = 0; p < permutations; p++) {
      let s = 0;
      for (let t = 0; t < k; t++) {
        const r = t + rng.int(n - 1 - t);
        const tmp = pool[t];
        pool[t] = pool[r];
        pool[r] = tmp;
        s += wt[t] * z[pool[t]];
      }
      sim[p] = ((n - 1) * z[i] * s) / den;
    }
    p_sim[i] = foldedP(sim, Is[i]);
  }
  return { z, lag, Is, q, p_sim, p_two: p_sim.map((p) => Math.min(1, 2 * p)), permutations, seed };
}

export type ClusterLabel = "HH" | "LL" | "HL" | "LH" | "ns";

/**
 * Map LISA results to cluster labels at significance `alpha` (two-sided
 * pseudo p-values), optionally controlling the false discovery rate across
 * all regions (Benjamini-Hochberg).
 */
export function lisaClusters(
  lisa: Pick<LocalMoranResult, "q" | "p_two">,
  { alpha = 0.05, fdr = false }: { alpha?: number; fdr?: boolean } = {},
): ClusterLabel[] {
  const p = fdr ? benjaminiHochberg(lisa.p_two) : lisa.p_two;
  const names: Record<Quadrant, ClusterLabel> = { 1: "HH", 2: "LH", 3: "LL", 4: "HL" };
  return lisa.q.map((q, i) => (p[i] < alpha ? names[q] : "ns"));
}
