/**
 * The text-to-SQL benchmark: questions about analytics.db with gold SQL
 * written by hand from the data (gold answers are the results of the gold SQL
 * on the shipped database; `benchmark.test.ts` pins them). Two questions are
 * deliberately unanswerable from this database: the right behaviour there is
 * to refuse, not to produce SQL.
 */

export interface BenchmarkItem {
  id: string;
  question: string;
  /** null for questions the database cannot answer */
  goldSql: string | null;
  /** what a correct answer has to get right, for readers of the results table */
  note: string;
  skill: "lookup" | "aggregate" | "join" | "ranking" | "ratio" | "refusal";
}

export const BENCHMARK: BenchmarkItem[] = [
  {
    id: "q01",
    question: "How many geotagged tweets were matched to Victorian suburbs between February and July 2022?",
    goldSql:
      "SELECT SUM(tweet_count) AS tweets FROM twitter_sal_sentiment WHERE topic = 'all' AND state = 'Victoria'",
    note: "Sum over the 'all' topic only (topics overlap).",
    skill: "aggregate",
  },
  {
    id: "q02",
    question:
      "Ignoring the outlier filter, which Victorian SA2 has the highest median personal income, and what is it?",
    goldSql:
      "SELECT sa2_name, median_aud FROM income_sa2 WHERE state = 'Victoria' ORDER BY median_aud DESC LIMIT 1",
    note: "All 457 Victorian SA2s, not only the 420 the IQR rule kept.",
    skill: "ranking",
  },
  {
    id: "q03",
    question: "How many Victorian local government areas did the team's IQR outlier rule keep?",
    goldSql: "SELECT COUNT(*) AS lgas FROM crime_lga WHERE iqr_kept = 1",
    note: "Uses the iqr_kept flag.",
    skill: "aggregate",
  },
  {
    id: "q04",
    question: "Which local government area recorded the most offences in 2019, and how many?",
    goldSql: "SELECT lga_name, total FROM crime_lga ORDER BY total DESC LIMIT 1",
    note: "Across all 79 LGAs, outliers included.",
    skill: "ranking",
  },
  {
    id: "q05",
    question: "What fraction (between 0 and 1) of crime-related tweets scored 1, the most negative score?",
    goldSql:
      "SELECT SUM(CASE WHEN score = 1 THEN count ELSE 0 END) * 1.0 / SUM(count) AS share FROM sentiment_histogram WHERE source = 'twitter' AND topic = 'crime'",
    note: "A ratio over the Twitter crime histogram; integer division would return 0.",
    skill: "ratio",
  },
  {
    id: "q06",
    question: "What is the average sentiment score of all tweets in the suburb of Geelong?",
    goldSql:
      "SELECT t.avg_score FROM twitter_sal_sentiment t JOIN regions_sal r USING (sal_code) WHERE r.name = 'Geelong' AND t.topic = 'all'",
    note: "Needs the join from suburb name to SAL code.",
    skill: "join",
  },
  {
    id: "q07",
    question: "How many of the re-scored mastodon.social toots were declared as English?",
    goldSql: "SELECT toots FROM mastodon_language WHERE server = 'mastodon.social' AND lang = 'en'",
    note: "Language code 'en'.",
    skill: "lookup",
  },
  {
    id: "q08",
    question:
      "In the re-scored mastodon.social week, which hourly bucket (the hour_utc timestamp) had the most toots?",
    goldSql: "SELECT hour_utc FROM mastodon_hourly ORDER BY toots DESC LIMIT 1",
    note: "One hourly bucket, as stored in hour_utc (not an hour of the day summed over the week).",
    skill: "ranking",
  },
  {
    id: "q09",
    question:
      "What Pearson correlation did the analysis find between median income and the sentiment of income tweets, across SA2s with at least one income tweet?",
    goldSql:
      "SELECT pearson_r FROM scenario_correlations WHERE scenario = 'income' AND y_metric = 'avg_income' AND min_tweets = 1",
    note: "Read the stored result rather than recomputing it.",
    skill: "lookup",
  },
  {
    id: "q10",
    question: "Which Greater Capital City area has the highest median income?",
    goldSql: "SELECT gcc_name FROM income_gcc ORDER BY median_aud DESC LIMIT 1",
    note: "From the capital-city summary table.",
    skill: "ranking",
  },
  {
    id: "q11",
    question: "List the five Victorian suburbs with the most crime-related tweets.",
    goldSql:
      "SELECT r.name FROM twitter_sal_sentiment t JOIN regions_sal r USING (sal_code) WHERE t.topic = 'crime' AND t.state = 'Victoria' ORDER BY t.tweet_count DESC LIMIT 5",
    note: "Five names; order is not scored.",
    skill: "join",
  },
  {
    id: "q12",
    question: "How many Victorian SA2s have personal income data?",
    goldSql: "SELECT COUNT(*) AS sa2s FROM income_sa2 WHERE state = 'Victoria'",
    note: "457, before the outlier rule.",
    skill: "aggregate",
  },
  {
    id: "q13",
    question: "What is the mean sentiment score of income-related tweets across Australia?",
    goldSql:
      "SELECT SUM(score * count) * 1.0 / SUM(count) AS mean_score FROM sentiment_histogram WHERE source = 'twitter' AND topic = 'income'",
    note: "A weighted mean over the histogram.",
    skill: "ratio",
  },
  {
    id: "q14",
    question: "How many drug offences were recorded in the City of Greater Geelong?",
    goldSql: "SELECT drug FROM crime_lga WHERE lga_name = 'Greater Geelong (C)'",
    note: "LGA names carry a type suffix.",
    skill: "lookup",
  },
  {
    id: "q15",
    question: "Which Twitter users posted the most crime-related tweets?",
    goldSql: null,
    note: "No user data is stored: the right answer is a refusal.",
    skill: "refusal",
  },
  {
    id: "q16",
    question: "What was the average sentiment of tweets in Sydney during 2024?",
    goldSql: null,
    note: "The tweets cover February-July 2022 only: the right answer is a refusal.",
    skill: "refusal",
  },
];
