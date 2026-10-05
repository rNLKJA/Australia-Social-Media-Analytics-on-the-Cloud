import "server-only";

import { cache } from "react";
import type {
  CrimeRegion,
  Fact,
  GccIncomeRow,
  Histogram,
  IncomeRegion,
  JobsIndicator,
  MastodonHour,
  MastodonLanguage,
  SalRegion,
  StoredCorrelation,
  Topic,
  TopicAgg,
} from "@/lib/types";
import { query } from "./db";

const BUCKETS = "b1, b2, b3, b4, b5, b6, b7, b8, b9";
type BucketRow = Record<"b1" | "b2" | "b3" | "b4" | "b5" | "b6" | "b7" | "b8" | "b9", number>;
const buckets = (r: BucketRow) => [r.b1, r.b2, r.b3, r.b4, r.b5, r.b6, r.b7, r.b8, r.b9];

export const getFacts = cache(async (): Promise<Record<string, Fact>> => {
  const rows = await query<{ key: string; value: number; unit: string; source: string }>(
    "SELECT key, value, unit, source FROM facts",
  );
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.value, unit: r.unit, source: r.source }]));
});

export const getHistograms = cache(async (): Promise<Histogram[]> => {
  const rows = await query<{ source: string; topic: Topic; score: number; count: number }>(
    "SELECT source, topic, score, count FROM sentiment_histogram ORDER BY source, topic, score",
  );
  const rescored = await query<{ server: string; topic: Topic; score: number; count: number }>(
    "SELECT server, topic, score, count FROM mastodon_rescored_histogram ORDER BY server, topic, score",
  );
  const map = new Map<string, Histogram>();
  for (const r of [...rows, ...rescored.map((x) => ({ ...x, source: `${x.server} (re-scored)` }))]) {
    const key = `${r.source}|${r.topic}`;
    const h = map.get(key) ?? { source: r.source, topic: r.topic, counts: Array(9).fill(0) };
    h.counts[r.score - 1] = r.count;
    map.set(key, h);
  }
  return [...map.values()];
});

export async function getHistogram(source: string, topic: Topic): Promise<Histogram> {
  const all = await getHistograms();
  const h = all.find((x) => x.source === source && x.topic === topic);
  if (!h) throw new Error(`No histogram for ${source}/${topic}`);
  return h;
}

/** Victorian SALs on the original Twitter map, with all three topic views. */
export const getSalRegions = cache(async (): Promise<SalRegion[]> => {
  const regions = await query<{
    sal_code: string;
    name: string;
    lat: number;
    lon: number;
    sa2_code16: string | null;
    lga_code19: string | null;
    sa2_name: string | null;
    lga_name: string | null;
  }>(
    `SELECT r.sal_code, r.name, r.lat, r.lon, r.sa2_code16, r.lga_code19, s.name AS sa2_name, l.name AS lga_name
       FROM regions_sal r
       LEFT JOIN regions_sa2 s ON s.sa2_code = r.sa2_code16
       LEFT JOIN regions_lga l ON l.lga_code = r.lga_code19
      WHERE r.on_original_map = 1 ORDER BY r.name`,
  );
  const aggs = await query<{
    sal_code: string;
    topic: Topic;
    tweet_count: number;
    score_sum: number;
    avg_score: number;
  }>(
    `SELECT t.sal_code, t.topic, t.tweet_count, t.score_sum, t.avg_score
       FROM twitter_sal_sentiment t JOIN regions_sal r USING (sal_code)
      WHERE r.on_original_map = 1`,
  );
  const byCode = new Map<string, Partial<Record<Topic, TopicAgg>>>();
  for (const a of aggs) {
    const m = byCode.get(a.sal_code) ?? {};
    m[a.topic] = { n: a.tweet_count, sum: a.score_sum, avg: a.avg_score };
    byCode.set(a.sal_code, m);
  }
  return regions.map((r) => {
    const m = byCode.get(r.sal_code) ?? {};
    return {
      code: r.sal_code,
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      sa2: r.sa2_code16,
      lga: r.lga_code19,
      sa2Name: r.sa2_name,
      lgaName: r.lga_name,
      all: m.all ?? null,
      income: m.income ?? null,
      crime: m.crime ?? null,
    };
  });
});

export const getIncomeRegions = cache(async (): Promise<IncomeRegion[]> => {
  const rows = await query<{
    sa2_code: string;
    sa2_name: string;
    median_aud: number;
    mean_aud: number;
    vic_iqr_kept: number;
    tweets_all: number;
    avg_all: number | null;
    sal_count: number;
    tweets_income: number;
    avg_income: number | null;
    sa3_name: string;
    sa4_name: string;
    gcc_code: string;
    lat: number;
    lon: number;
  }>(
    `SELECT s.*, r.sa3_name, r.sa4_name, r.gcc_code, r.lat, r.lon
       FROM scenario_income_sa2 s JOIN regions_sa2 r USING (sa2_code)
      ORDER BY s.sa2_name`,
  );
  return rows.map((r) => ({
    code: r.sa2_code,
    name: r.sa2_name,
    sa3: r.sa3_name,
    sa4: r.sa4_name,
    gcc: r.gcc_code,
    lat: r.lat,
    lon: r.lon,
    medianAud: r.median_aud,
    meanAud: r.mean_aud,
    kept: r.vic_iqr_kept === 1,
    salCount: r.sal_count,
    tweetsAll: r.tweets_all,
    avgAll: r.avg_all,
    tweetsIncome: r.tweets_income,
    avgIncome: r.avg_income,
  }));
});

export const getCrimeRegions = cache(async (): Promise<CrimeRegion[]> => {
  const rows = await query<{
    lga_code: string;
    lga_name: string;
    total: number;
    iqr_kept: number;
    tweets_all: number;
    avg_all: number | null;
    sal_count: number;
    tweets_crime: number;
    avg_crime: number | null;
    against_person: number;
    property_deception: number;
    drug: number;
    public_order: number;
    justice: number;
    other: number;
    lat: number;
    lon: number;
    area_km2: number;
  }>(
    `SELECT s.*, c.against_person, c.property_deception, c.drug, c.public_order, c.justice, c.other,
            r.lat, r.lon, r.area_km2
       FROM scenario_crime_lga s
       JOIN crime_lga c USING (lga_code)
       JOIN regions_lga r USING (lga_code)
      ORDER BY s.lga_name`,
  );
  return rows.map((r) => ({
    code: r.lga_code,
    name: r.lga_name,
    lat: r.lat,
    lon: r.lon,
    areaKm2: r.area_km2,
    total: r.total,
    categories: {
      againstPerson: r.against_person,
      propertyDeception: r.property_deception,
      drug: r.drug,
      publicOrder: r.public_order,
      justice: r.justice,
      other: r.other,
    },
    kept: r.iqr_kept === 1,
    salCount: r.sal_count,
    tweetsAll: r.tweets_all,
    avgAll: r.avg_all,
    tweetsCrime: r.tweets_crime,
    avgCrime: r.avg_crime,
  }));
});

export const getCorrelations = cache(async (): Promise<StoredCorrelation[]> => {
  const rows = await query<{
    scenario: "income" | "crime";
    unit: "sa2" | "lga" | "sal";
    x_metric: string;
    y_metric: string;
    weight_metric: string;
    min_tweets: number;
    n: number;
    pearson_r: number;
    pearson_p: number;
    spearman_rho: number;
    spearman_p: number;
    slope: number;
    intercept: number;
    r2: number;
  }>("SELECT * FROM scenario_correlations ORDER BY scenario, unit, y_metric, min_tweets");
  return rows.map((r) => ({
    scenario: r.scenario,
    unit: r.unit,
    xMetric: r.x_metric,
    yMetric: r.y_metric,
    weightMetric: r.weight_metric,
    minTweets: r.min_tweets,
    n: r.n,
    pearsonR: r.pearson_r,
    pearsonP: r.pearson_p,
    spearmanRho: r.spearman_rho,
    spearmanP: r.spearman_p,
    slope: r.slope,
    intercept: r.intercept,
    r2: r.r2,
  }));
});

export const getGccIncome = cache(async (): Promise<GccIncomeRow[]> => {
  const rows = await query<{
    gcc_code: string;
    gcc_name: string;
    mean_aud: number;
    median_aud: number;
    sum_aud: number;
    median_age: number;
    sa2_count: number;
  }>("SELECT * FROM income_gcc ORDER BY gcc_code");
  return rows.map((r) => ({
    code: r.gcc_code,
    name: r.gcc_name,
    meanAud: r.mean_aud,
    medianAud: r.median_aud,
    sumAud: r.sum_aud,
    medianAge: r.median_age,
    sa2Count: r.sa2_count,
  }));
});

export const getJobsIndicators = cache(async (): Promise<JobsIndicator[]> =>
  query<JobsIndicator>("SELECT indicator, label, kind, mean, std, median FROM jobs_income_indicators"),
);

export const getMastodonHourly = cache(async (): Promise<MastodonHour[]> => {
  const rows = await query<
    {
      hour_utc: string;
      toots: number;
      score_sum: number;
      income_toots: number;
      crime_toots: number;
    } & BucketRow
  >(
    `SELECT hour_utc, toots, score_sum, income_toots, crime_toots, ${BUCKETS}
       FROM mastodon_hourly WHERE server = 'mastodon.social' ORDER BY hour_utc`,
  );
  return rows.map((r) => ({
    hour: r.hour_utc,
    toots: r.toots,
    scoreSum: r.score_sum,
    incomeToots: r.income_toots,
    crimeToots: r.crime_toots,
    buckets: buckets(r),
  }));
});

export const getMastodonLanguages = cache(async (): Promise<MastodonLanguage[]> => {
  const rows = await query<
    { lang: string; toots: number; score_sum: number; income_toots: number } & BucketRow
  >(
    `SELECT lang, toots, score_sum, income_toots, ${BUCKETS}
       FROM mastodon_language WHERE server = 'mastodon.social' ORDER BY toots DESC`,
  );
  return rows.map((r) => ({
    lang: r.lang,
    toots: r.toots,
    scoreSum: r.score_sum,
    incomeToots: r.income_toots,
    buckets: buckets(r),
  }));
});

export const getSummaryText = cache(async (source: "twitter" | "sudo" | "mastodon", dataset?: string) => {
  const rows = await query<{ dataset: string; paragraph: number; text: string }>(
    `SELECT dataset, paragraph, text FROM summary_text WHERE source = ? ${dataset ? "AND dataset = ?" : ""}
      ORDER BY dataset, paragraph`,
    dataset ? [source, dataset] : [source],
  );
  return rows;
});
