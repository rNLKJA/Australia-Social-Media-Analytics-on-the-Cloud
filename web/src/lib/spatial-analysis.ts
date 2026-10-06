/**
 * The spatial statistics behind /spatial and the uncertainty panels on the
 * scenario pages, as pure functions of the regional records (so the server
 * can prerender the defaults and the browser can recompute when a reader
 * changes the threshold or the weights, with identical results).
 */
import {
  areaMean,
  type BootstrapInterval,
  type ClusterLabel,
  DEFAULT_SEED,
  knnNeighbors,
  lisaClusters,
  localMoran,
  MIN_TWEETS_RELIABLE,
  moran,
  type MoranResult,
  type Neighbors,
  ols,
  type OlsResult,
  projectLonLat,
  rowStandardise,
  spearmanBootstrap,
  type Weights,
} from "@/lib/stats";
import type { Adjacency, AreaRecord, SpatialUnit, Topic } from "@/lib/types";

export type WeightsKind = "knn6" | "rook";

export const WEIGHTS_LABEL: Record<WeightsKind, string> = {
  knn6: "6 nearest neighbours",
  rook: "Shared border (rook)",
};

export const SPATIAL_DEFAULTS = {
  minTweets: MIN_TWEETS_RELIABLE,
  weights: "knn6" as WeightsKind,
  permutations: 999,
  seed: DEFAULT_SEED,
  alpha: 0.05,
  fdr: false,
  bootstrap: 2000,
};

/** Fewer analysed regions than this and no spatial statistic is reported. */
export const MIN_REGIONS = 12;

export type RegionStatus = "analysed" | "suppressed" | "island" | "no-tweets";

export interface RegionStat {
  code: string;
  name: string;
  n: number;
  mean: number | null;
  se: number | null;
  lower: number | null;
  upper: number | null;
  status: RegionStatus;
  lisa?: { z: number; lag: number; Is: number; p: number; cluster: ClusterLabel };
}

export interface SpatialOptions {
  topic: Topic;
  minTweets?: number;
  weights?: WeightsKind;
  permutations?: number;
  seed?: number;
  alpha?: number;
  fdr?: boolean;
}

export interface SpatialResult {
  topic: Topic;
  minTweets: number;
  weights: WeightsKind;
  permutations: number;
  seed: number;
  alpha: number;
  fdr: boolean;
  /** every region, in input order */
  regions: RegionStat[];
  analysed: number;
  suppressed: number;
  noTweets: number;
  islands: number;
  moran: MoranResult | null;
  clusterCounts: Record<ClusterLabel, number>;
}

/**
 * Row-standardised weights over `areas`. k-NN uses each region's
 * representative point; rook uses the shared-border adjacency restricted to
 * `areas` and drops regions left without a neighbour.
 */
export function buildWeights(
  areas: Pick<AreaRecord, "code" | "lat" | "lon">[],
  kind: WeightsKind,
  adjacency: Adjacency,
): { kept: number[]; islands: number[]; weights: Weights } {
  if (kind === "knn6") {
    const nb = knnNeighbors(
      areas.map((a) => projectLonLat(a.lon, a.lat)),
      6,
    );
    return { kept: areas.map((_, i) => i), islands: [], weights: rowStandardise(nb) };
  }
  const pos = new Map(areas.map((a, i) => [a.code, i]));
  const raw: Neighbors = areas.map((a) =>
    (adjacency[a.code] ?? [])
      .map((c) => pos.get(c))
      .filter((j): j is number => j !== undefined)
      .sort((x, y) => x - y),
  );
  const kept = raw.map((nb, i) => (nb.length ? i : -1)).filter((i) => i >= 0);
  const islands = raw.map((nb, i) => (nb.length ? -1 : i)).filter((i) => i >= 0);
  const remap = new Map(kept.map((i, k) => [i, k]));
  const nb = kept.map((i) => raw[i].map((j) => remap.get(j)!));
  return { kept, islands, weights: rowStandardise(nb) };
}

function emptyCounts(): Record<ClusterLabel, number> {
  return { HH: 0, LL: 0, HL: 0, LH: 0, ns: 0 };
}

/** Global and local Moran's I of regional average sentiment, with small-area suppression. */
export function analyseSpatial(
  areas: AreaRecord[],
  adjacency: Adjacency,
  opts: SpatialOptions,
): SpatialResult {
  const o = { ...SPATIAL_DEFAULTS, ...opts };
  const regions: RegionStat[] = areas.map((a) => {
    const s = a.sums[o.topic];
    if (!s || s.n === 0)
      return {
        code: a.code,
        name: a.name,
        n: 0,
        mean: null,
        se: null,
        lower: null,
        upper: null,
        status: "no-tweets",
      };
    const m = areaMean(s);
    return {
      code: a.code,
      name: a.name,
      n: s.n,
      mean: m.mean,
      se: m.se,
      lower: m.lower,
      upper: m.upper,
      status: s.n >= o.minTweets ? "analysed" : "suppressed",
    };
  });
  const candidates = regions.map((r, i) => (r.status === "analysed" ? i : -1)).filter((i) => i >= 0);
  const { kept, islands, weights } = buildWeights(
    candidates.map((i) => areas[i]),
    o.weights,
    adjacency,
  );
  for (const k of islands) regions[candidates[k]].status = "island";
  const idx = kept.map((k) => candidates[k]);
  const counts = emptyCounts();
  let moranResult: MoranResult | null = null;
  if (idx.length >= MIN_REGIONS) {
    const y = idx.map((i) => regions[i].mean as number);
    const perm = { permutations: o.permutations, seed: o.seed };
    moranResult = moran(y, weights, perm);
    const lisa = localMoran(y, weights, perm);
    const labels = lisaClusters(lisa, { alpha: o.alpha, fdr: o.fdr });
    idx.forEach((i, k) => {
      regions[i].lisa = {
        z: lisa.z[k],
        lag: lisa.lag[k],
        Is: lisa.Is[k],
        p: lisa.p_two[k],
        cluster: labels[k],
      };
      counts[labels[k]]++;
    });
  }
  return {
    topic: o.topic,
    minTweets: o.minTweets,
    weights: o.weights,
    permutations: o.permutations,
    seed: o.seed,
    alpha: o.alpha,
    fdr: o.fdr,
    regions,
    analysed: idx.length,
    suppressed: regions.filter((r) => r.status === "suppressed").length,
    noTweets: regions.filter((r) => r.status === "no-tweets").length,
    islands: islands.length,
    moran: moranResult,
    clusterCounts: counts,
  };
}

export interface RelationshipOptions {
  topic: Topic;
  minTweets?: number;
  includeOutliers?: boolean;
  weights?: WeightsKind;
  bootstrap?: number;
  seed?: number;
}

export interface RelationshipResult {
  unit: SpatialUnit;
  topic: Topic;
  minTweets: number;
  includeOutliers: boolean;
  n: number;
  /** what one unit of x means, for the slope */
  xLabel: string;
  points: { code: string; name: string; x: number; y: number; n: number }[];
  spearman: BootstrapInterval | null;
  ols: OlsResult | null;
  /** Moran's I of the OLS residuals: spatial structure the model leaves behind */
  residualMoran: MoranResult | null;
}

export const X_LABEL: Record<SpatialUnit, string> = {
  sa2: "median personal income, per $10,000",
  lga: "recorded offences, per tenfold increase",
};

/**
 * Scenario relationship with uncertainty: income (SA2) or offences (LGA)
 * against regional average sentiment, for regions kept by the team's IQR rule
 * (unless `includeOutliers`) with at least `minTweets` tweets.
 */
export function analyseRelationship(
  unit: SpatialUnit,
  areas: AreaRecord[],
  adjacency: Adjacency,
  opts: RelationshipOptions,
): RelationshipResult {
  const minTweets = opts.minTweets ?? SPATIAL_DEFAULTS.minTweets;
  const includeOutliers = opts.includeOutliers ?? false;
  const seed = opts.seed ?? SPATIAL_DEFAULTS.seed;
  const sample = areas.filter((a) => {
    const s = a.sums[opts.topic];
    return (
      a.covariate !== null &&
      a.covariate > 0 &&
      (includeOutliers || a.kept === true) &&
      s !== undefined &&
      s.n >= Math.max(1, minTweets)
    );
  });
  const points = sample.map((a) => {
    const s = a.sums[opts.topic]!;
    return {
      code: a.code,
      name: a.name,
      x: unit === "sa2" ? (a.covariate as number) / 10000 : Math.log10(a.covariate as number),
      y: s.sum / s.n,
      n: s.n,
    };
  });
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const enough = points.length >= MIN_REGIONS;
  const fit = enough ? ols([xs], ys, [unit === "sa2" ? "income_10k" : "log10_offences"]) : null;
  let residualMoran: MoranResult | null = null;
  if (fit) {
    const { kept, weights } = buildWeights(sample, opts.weights ?? SPATIAL_DEFAULTS.weights, adjacency);
    if (kept.length >= MIN_REGIONS)
      residualMoran = moran(
        kept.map((i) => fit.residuals[i]),
        weights,
        { permutations: SPATIAL_DEFAULTS.permutations, seed },
      );
  }
  return {
    unit,
    topic: opts.topic,
    minTweets,
    includeOutliers,
    n: points.length,
    xLabel: X_LABEL[unit],
    points,
    spearman: enough
      ? spearmanBootstrap(xs, ys, { B: opts.bootstrap ?? SPATIAL_DEFAULTS.bootstrap, seed })
      : null,
    ols: fit,
    residualMoran,
  };
}
