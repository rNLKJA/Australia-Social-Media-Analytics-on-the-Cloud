/**
 * The documented schema of analytics.db: one source of truth for the
 * /records pages, the "Ask the data" prompt (the model sees exactly this) and
 * the server-side SQL allow-list. `schema.test.ts` checks it against the real
 * database, so a rebuilt database cannot drift from what the model is told.
 */

export interface ColumnDoc {
  name: string;
  type: "TEXT" | "INTEGER" | "REAL";
  description: string;
}

export interface TableDoc {
  name: string;
  group: "Context" | "Sentiment" | "Geography" | "SUDO" | "Scenarios";
  title: string;
  description: string;
  columns: ColumnDoc[];
}

const c = (name: string, type: ColumnDoc["type"], description: string): ColumnDoc => ({
  name,
  type,
  description,
});

const buckets = Array.from({ length: 9 }, (_, i) =>
  c(`b${i + 1}`, "INTEGER", `toots scored ${i + 1} on the 1-9 scale`),
);

export const SCHEMA: TableDoc[] = [
  {
    name: "facts",
    group: "Context",
    title: "Facts",
    description: "Headline numbers quoted in the team report, each with its source section.",
    columns: [
      c("key", "TEXT", "identifier, e.g. tweets_processed, toots_harvested, vic_sa2_income_kept"),
      c("value", "REAL", "the number"),
      c("unit", "TEXT", "unit of value, e.g. tweets, GB, SA2s"),
      c("source", "TEXT", "where the number comes from"),
    ],
  },
  {
    name: "meta",
    group: "Context",
    title: "Build metadata",
    description: "Editions of the boundaries and how the database was built.",
    columns: [c("key", "TEXT", "e.g. twitter_period, sa2_edition"), c("value", "TEXT", "value")],
  },
  {
    name: "summary_text",
    group: "Context",
    title: "Original summaries",
    description: "The paragraphs the 2023 dashboard showed beside each chart (written by the team).",
    columns: [
      c("source", "TEXT", "'twitter', 'sudo' or 'mastodon'"),
      c("dataset", "TEXT", "dataset the paragraph describes"),
      c("paragraph", "INTEGER", "paragraph number"),
      c("text", "TEXT", "paragraph text"),
    ],
  },
  {
    name: "sentiment_histogram",
    group: "Sentiment",
    title: "Sentiment histograms (2023 dashboard)",
    description:
      "Counts of 1-9 sentiment scores for Twitter and the three Mastodon servers, as plotted in 2023. Twitter covers geotagged tweets Australia-wide, Feb-Jul 2022.",
    columns: [
      c("source", "TEXT", "'twitter', 'mastodon.social', 'mastodon.au' or 'tictoc.social'"),
      c("topic", "TEXT", "'all', 'income' or 'crime' (crime only for twitter)"),
      c("score", "INTEGER", "sentiment score 1 (extremely negative) to 9 (extremely positive); 5 is neutral"),
      c("count", "INTEGER", "number of posts with this score"),
    ],
  },
  {
    name: "twitter_sal_sentiment",
    group: "Sentiment",
    title: "Twitter sentiment by suburb (SAL)",
    description:
      "CouchDB MapReduce _stats per suburb and topic (all tweets, income keywords, crime keywords), Feb-Jul 2022, every Australian state. Rows are keyed by SAL code: join regions_sal for names.",
    columns: [
      c("sal_code", "TEXT", "ABS 2021 suburb/locality code (join regions_sal.sal_code)"),
      c("topic", "TEXT", "'all', 'income' or 'crime'"),
      c("state", "TEXT", "state name, e.g. 'Victoria', 'New South Wales'"),
      c("tweet_count", "INTEGER", "tweets in this suburb and topic"),
      c("score_sum", "INTEGER", "sum of the tweets' 1-9 scores"),
      c("score_min", "INTEGER", "lowest score"),
      c("score_max", "INTEGER", "highest score"),
      c("score_sumsqr", "INTEGER", "sum of squared scores"),
      c("avg_score", "REAL", "score_sum / tweet_count rounded to 2 decimals (the 2023 dashboard's value)"),
    ],
  },
  {
    name: "mastodon_servers",
    group: "Sentiment",
    title: "Mastodon servers",
    description: "The three servers the harvesters followed.",
    columns: [
      c("server", "TEXT", "'mastodon.social', 'mastodon.au' or 'tictoc.social'"),
      c("label", "TEXT", "display name"),
      c("url", "TEXT", "server URL"),
      c("description", "TEXT", "short description"),
    ],
  },
  {
    name: "mastodon_rescored_histogram",
    group: "Sentiment",
    title: "mastodon.social re-scored histogram",
    description:
      "The surviving week of mastodon.social toots (1-9 May 2023) re-scored with the original pipeline (aggregates only).",
    columns: [
      c("server", "TEXT", "always 'mastodon.social'"),
      c("topic", "TEXT", "'all', 'income' or 'crime'"),
      c("score", "INTEGER", "sentiment score 1-9"),
      c("count", "INTEGER", "toots with this score"),
    ],
  },
  {
    name: "mastodon_hourly",
    group: "Sentiment",
    title: "mastodon.social by hour",
    description:
      "Re-scored mastodon.social toots per UTC hour, 1-9 May 2023, with score sums and 1-9 bucket counts.",
    columns: [
      c("server", "TEXT", "always 'mastodon.social'"),
      c("hour_utc", "TEXT", "hour start in UTC, ISO format e.g. '2023-05-01T13:00:00Z'"),
      c("toots", "INTEGER", "toots in the hour"),
      c("score_sum", "INTEGER", "sum of 1-9 scores (average = score_sum / toots)"),
      c("income_toots", "INTEGER", "toots matching the income keywords"),
      c("income_score_sum", "INTEGER", "sum of scores of income toots"),
      c("crime_toots", "INTEGER", "toots matching the crime keywords"),
      ...buckets,
    ],
  },
  {
    name: "mastodon_language",
    group: "Sentiment",
    title: "mastodon.social by language",
    description:
      "Re-scored mastodon.social toots (1-9 May 2023) per declared language, with score sums and bucket counts.",
    columns: [
      c("server", "TEXT", "always 'mastodon.social'"),
      c(
        "lang",
        "TEXT",
        "ISO 639-1 language code declared by the toot, e.g. 'en', 'de', 'ja'; 'und' = undetermined",
      ),
      c("toots", "INTEGER", "toots in this language"),
      c("score_sum", "INTEGER", "sum of 1-9 scores"),
      c("income_toots", "INTEGER", "toots matching the income keywords"),
      ...buckets,
    ],
  },
  {
    name: "regions_sal",
    group: "Geography",
    title: "Suburbs and localities (SAL 2021)",
    description:
      "ABS suburbs and localities that had tweets, every state, with a representative point and (Victoria only) the SA2 and LGA they fall in.",
    columns: [
      c("sal_code", "TEXT", "ABS 2021 SAL code"),
      c("name", "TEXT", "suburb name, e.g. 'Melbourne', 'Geelong', 'Ballarat Central'"),
      c("state", "TEXT", "state name, e.g. 'Victoria'"),
      c("area_km2", "REAL", "area in square kilometres"),
      c("lat", "REAL", "latitude of a representative point"),
      c("lon", "REAL", "longitude of a representative point"),
      c("sa2_code16", "TEXT", "2016 SA2 containing the point (Victoria only; join regions_sa2.sa2_code)"),
      c("lga_code19", "TEXT", "2019 LGA containing the point (Victoria only; join regions_lga.lga_code)"),
      c("on_original_map", "INTEGER", "1 if drawn on the 2023 Victorian Twitter map"),
    ],
  },
  {
    name: "regions_sa2",
    group: "Geography",
    title: "Victorian SA2s (2016)",
    description: "ABS Statistical Area Level 2 regions in Victoria.",
    columns: [
      c("sa2_code", "TEXT", "2016 SA2 code"),
      c("name", "TEXT", "SA2 name"),
      c("sa3_name", "TEXT", "parent SA3"),
      c("sa4_name", "TEXT", "parent SA4"),
      c("gcc_code", "TEXT", "Greater Capital City code: '2GMEL' Greater Melbourne, '2RVIC' rest of Victoria"),
      c("area_km2", "REAL", "area in square kilometres"),
      c("lat", "REAL", "latitude of a representative point"),
      c("lon", "REAL", "longitude of a representative point"),
    ],
  },
  {
    name: "regions_lga",
    group: "Geography",
    title: "Victorian LGAs (2019)",
    description: "ABS Local Government Areas in Victoria.",
    columns: [
      c("lga_code", "TEXT", "2019 LGA code"),
      c("name", "TEXT", "LGA name with type suffix, e.g. 'Ballarat (C)', 'Alpine (S)'"),
      c("area_km2", "REAL", "area in square kilometres"),
      c("lat", "REAL", "latitude of a representative point"),
      c("lon", "REAL", "longitude of a representative point"),
    ],
  },
  {
    name: "income_sa2",
    group: "SUDO",
    title: "Personal income by SA2",
    description:
      "SUDO / ABS personal income 2015-16 (mean, median, sum, median age of earners) for every Australian SA2.",
    columns: [
      c("sa2_code", "TEXT", "2016 SA2 code"),
      c("sa2_name", "TEXT", "SA2 name"),
      c("sa3_name", "TEXT", "parent SA3"),
      c("sa4_name", "TEXT", "parent SA4"),
      c("gcc_code", "TEXT", "Greater Capital City code"),
      c("gcc_name", "TEXT", "Greater Capital City name, e.g. 'Greater Melbourne'"),
      c("state", "TEXT", "state name"),
      c("mean_aud", "REAL", "mean personal income, AUD"),
      c("median_aud", "REAL", "median personal income, AUD"),
      c("sum_aud", "REAL", "total personal income, AUD"),
      c("median_age", "REAL", "median age of earners"),
      c("on_national_map", "INTEGER", "1 if on the 2023 national income map"),
      c(
        "vic_iqr_kept",
        "INTEGER",
        "Victoria only: 1 if kept by the team's IQR outlier rule (420 of 457), else 0; NULL outside Victoria",
      ),
    ],
  },
  {
    name: "income_gcc",
    group: "SUDO",
    title: "Personal income by capital city area",
    description: "The SA2 rows grouped by Greater Capital City Statistical Area, as in the original summary.",
    columns: [
      c("gcc_code", "TEXT", "e.g. '1GSYD', '2GMEL', '8ACTE', '2RVIC'"),
      c("gcc_name", "TEXT", "e.g. 'Greater Sydney', 'Rest of Vic.'"),
      c("mean_aud", "REAL", "mean of the SA2 mean incomes, AUD"),
      c("median_aud", "REAL", "median of the SA2 median incomes, AUD"),
      c("sum_aud", "REAL", "total income, AUD"),
      c("median_age", "REAL", "mean of the SA2 median ages"),
      c("sa2_count", "INTEGER", "number of SA2s"),
    ],
  },
  {
    name: "jobs_income_indicators",
    group: "SUDO",
    title: "Jobs and income by industry",
    description:
      "ABS Jobs in Australia 2018-19 indicators (mean, sd and median across SA2s) from the original bar chart.",
    columns: [
      c("indicator", "TEXT", "machine name of the indicator"),
      c("label", "TEXT", "readable label, e.g. 'Health care social assistance - median income per job'"),
      c("kind", "TEXT", "'income_aud' (median income per job, AUD) or 'jobs_000' (thousands of jobs)"),
      c("mean", "REAL", "mean across SA2s"),
      c("std", "REAL", "standard deviation across SA2s"),
      c("median", "REAL", "median across SA2s"),
    ],
  },
  {
    name: "crime_lga",
    group: "SUDO",
    title: "Recorded offences by LGA",
    description: "Victorian Crime Statistics Agency offence divisions per LGA (reference year 2019).",
    columns: [
      c("lga_code", "TEXT", "LGA code (join regions_lga.lga_code)"),
      c("lga_name", "TEXT", "LGA name with suffix, e.g. 'Melbourne (C)', 'Greater Geelong (C)'"),
      c("against_person", "INTEGER", "offences against the person"),
      c("property_deception", "INTEGER", "property and deception offences"),
      c("drug", "INTEGER", "drug offences"),
      c("public_order", "INTEGER", "public order and security offences"),
      c("justice", "INTEGER", "justice procedures offences"),
      c("other", "INTEGER", "other offences"),
      c("reference_period", "INTEGER", "year, always 2019"),
      c("iqr_kept", "INTEGER", "1 if kept by the team's IQR outlier rule (72 of 79)"),
      c("total", "INTEGER", "all recorded offences"),
    ],
  },
  {
    name: "scenario_income_sa2",
    group: "Scenarios",
    title: "Scenario 1: income vs sentiment",
    description:
      "Median income joined with suburb tweet sentiment pooled to each Victorian SA2 (revival analysis). avg_* are NULL where an SA2 had no tweets.",
    columns: [
      c("sa2_code", "TEXT", "2016 SA2 code"),
      c("sa2_name", "TEXT", "SA2 name"),
      c("median_aud", "REAL", "median personal income, AUD"),
      c("mean_aud", "REAL", "mean personal income, AUD"),
      c("vic_iqr_kept", "INTEGER", "1 if kept by the team's IQR outlier rule"),
      c("tweets_all", "INTEGER", "geotagged tweets pooled from the SA2's suburbs"),
      c("avg_all", "REAL", "average 1-9 score of those tweets"),
      c("sal_count", "INTEGER", "suburbs with tweets in the SA2"),
      c("tweets_income", "INTEGER", "income-related tweets"),
      c("avg_income", "REAL", "average score of income-related tweets"),
    ],
  },
  {
    name: "scenario_crime_lga",
    group: "Scenarios",
    title: "Scenario 2: crime vs sentiment",
    description:
      "Offence totals joined with suburb tweet sentiment pooled to each Victorian LGA (revival analysis).",
    columns: [
      c("lga_code", "TEXT", "LGA code"),
      c("lga_name", "TEXT", "LGA name with suffix"),
      c("total", "INTEGER", "recorded offences, 2019"),
      c("iqr_kept", "INTEGER", "1 if kept by the team's IQR outlier rule"),
      c("tweets_all", "INTEGER", "geotagged tweets pooled from the LGA's suburbs"),
      c("avg_all", "REAL", "average 1-9 score of those tweets"),
      c("sal_count", "INTEGER", "suburbs with tweets in the LGA"),
      c("tweets_crime", "INTEGER", "crime-related tweets"),
      c("avg_crime", "REAL", "average score of crime-related tweets"),
    ],
  },
  {
    name: "scenario_correlations",
    group: "Scenarios",
    title: "Scenario correlations",
    description:
      "Pearson, Spearman and least-squares fits at several minimum-tweet thresholds (computed with scipy).",
    columns: [
      c("scenario", "TEXT", "'income' or 'crime'"),
      c("unit", "TEXT", "'sa2', 'lga' or 'sal'"),
      c("x_metric", "TEXT", "'median_aud', 'total' or 'log10_tweets'"),
      c("y_metric", "TEXT", "'avg_income', 'avg_all', 'avg_crime' or 'avg_raw'"),
      c("weight_metric", "TEXT", "column used for the minimum-tweet threshold"),
      c("min_tweets", "INTEGER", "minimum tweets per region: 1, 5, 10 or 30"),
      c("n", "INTEGER", "regions in the fit"),
      c("pearson_r", "REAL", "Pearson correlation"),
      c("pearson_p", "REAL", "two-sided p-value of pearson_r"),
      c("spearman_rho", "REAL", "Spearman rank correlation"),
      c("spearman_p", "REAL", "two-sided p-value of spearman_rho"),
      c("slope", "REAL", "least-squares slope"),
      c("intercept", "REAL", "least-squares intercept"),
      c("r2", "REAL", "R squared"),
    ],
  },
];

export const TABLE_NAMES = SCHEMA.map((t) => t.name);

/** lower-cased table -> lower-cased column names */
export const ALLOWED: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  SCHEMA.map((t) => [t.name.toLowerCase(), new Set(t.columns.map((col) => col.name.toLowerCase()))]),
);

/** Compact schema text for the model prompt. */
export function schemaPrompt(): string {
  return SCHEMA.map(
    (t) =>
      `TABLE ${t.name} -- ${t.description}\n` +
      t.columns.map((col) => `  ${col.name} ${col.type} -- ${col.description}`).join("\n"),
  ).join("\n\n");
}
