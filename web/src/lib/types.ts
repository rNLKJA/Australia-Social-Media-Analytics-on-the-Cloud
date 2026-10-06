/** Shapes shared between the server data layer and client components. */

export type Topic = "all" | "income" | "crime";

/** A CouchDB `_stats` reduce result for one region and topic. */
export interface TopicAgg {
  /** tweets in the view */
  n: number;
  /** sum of 1-9 scores */
  sum: number;
  /** the original dashboard's value: round(sum / n, 2) */
  avg: number;
}

export interface SalRegion {
  code: string;
  name: string;
  lat: number;
  lon: number;
  sa2: string | null;
  lga: string | null;
  sa2Name: string | null;
  lgaName: string | null;
  all: TopicAgg | null;
  income: TopicAgg | null;
  crime: TopicAgg | null;
}

export interface IncomeRegion {
  code: string;
  name: string;
  sa3: string;
  sa4: string;
  gcc: string;
  lat: number;
  lon: number;
  medianAud: number;
  meanAud: number;
  /** kept by the team's IQR filter (420 of 457) */
  kept: boolean;
  salCount: number;
  tweetsAll: number;
  avgAll: number | null;
  tweetsIncome: number;
  avgIncome: number | null;
}

export const CRIME_CATEGORIES = [
  { key: "againstPerson", label: "Against the person" },
  { key: "propertyDeception", label: "Property and deception" },
  { key: "drug", label: "Drug offences" },
  { key: "publicOrder", label: "Public order and security" },
  { key: "justice", label: "Justice procedures" },
  { key: "other", label: "Other offences" },
] as const;

export type CrimeCategoryKey = (typeof CRIME_CATEGORIES)[number]["key"];

export interface CrimeRegion {
  code: string;
  name: string;
  lat: number;
  lon: number;
  areaKm2: number;
  total: number;
  categories: Record<CrimeCategoryKey, number>;
  /** kept by the team's IQR filter (72 of 79) */
  kept: boolean;
  salCount: number;
  tweetsAll: number;
  avgAll: number | null;
  tweetsCrime: number;
  avgCrime: number | null;
}

export interface StoredCorrelation {
  scenario: "income" | "crime";
  unit: "sa2" | "lga" | "sal";
  xMetric: string;
  yMetric: string;
  weightMetric: string;
  minTweets: number;
  n: number;
  pearsonR: number;
  pearsonP: number;
  spearmanRho: number;
  spearmanP: number;
  slope: number;
  intercept: number;
  r2: number;
}

export interface Histogram {
  source: string;
  topic: Topic;
  /** counts for scores 1..9 */
  counts: number[];
}

export interface Fact {
  value: number;
  unit: string;
  source: string;
}

export interface MastodonHour {
  hour: string;
  toots: number;
  scoreSum: number;
  incomeToots: number;
  crimeToots: number;
  buckets: number[];
}

export interface MastodonLanguage {
  lang: string;
  toots: number;
  scoreSum: number;
  incomeToots: number;
  buckets: number[];
}

export interface GccIncomeRow {
  code: string;
  name: string;
  meanAud: number;
  medianAud: number;
  sumAud: number;
  medianAge: number;
  sa2Count: number;
}

export interface JobsIndicator {
  indicator: string;
  label: string;
  kind: "income_aud" | "jobs_000";
  mean: number;
  std: number;
  median: number;
}

/** The `_stats` reduce of one region's 1-9 scores, pooled from its suburbs. */
export interface ScoreSums {
  n: number;
  sum: number;
  /** sum of squared scores */
  sumsq: number;
}

/** A Victorian SA2 or LGA with tweet score sums and its scenario covariate. */
export interface AreaRecord {
  code: string;
  name: string;
  lat: number;
  lon: number;
  sums: Partial<Record<Topic, ScoreSums>>;
  /** median personal income (SA2) or recorded offences (LGA); null without SUDO data */
  covariate: number | null;
  /** kept by the team's IQR outlier rule; null without SUDO data */
  kept: boolean | null;
}

export type SpatialUnit = "sa2" | "lga";

/** Rook contiguity from the TopoJSON's shared arcs: code -> neighbouring codes. */
export type Adjacency = Record<string, string[]>;
