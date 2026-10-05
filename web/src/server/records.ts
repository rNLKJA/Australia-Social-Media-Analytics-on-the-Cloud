import "server-only";

import { cache } from "react";
import { z } from "zod";
import { query } from "./db";

/** Human descriptions of each analytics.db table (shown on /records). */
export const TABLE_DOCS: Record<string, { title: string; description: string; group: string }> = {
  facts: {
    group: "Context",
    title: "Facts",
    description: "Headline numbers quoted in the team report, each with its source section.",
  },
  meta: { group: "Context", title: "Build metadata", description: "Editions of the boundaries and how the database was built." },
  summary_text: {
    group: "Context",
    title: "Original summaries",
    description: "The paragraphs the 2023 dashboard showed beside each chart (written by the team).",
  },
  sentiment_histogram: {
    group: "Sentiment",
    title: "Sentiment histograms (2023 dashboard)",
    description: "Counts of 1-9 sentiment scores for Twitter and the three Mastodon servers, as plotted in 2023.",
  },
  twitter_sal_sentiment: {
    group: "Sentiment",
    title: "Twitter sentiment by suburb (SAL)",
    description:
      "CouchDB MapReduce _stats per suburb and topic (all tweets, income keywords, crime keywords), Feb-Jul 2022.",
  },
  mastodon_servers: { group: "Sentiment", title: "Mastodon servers", description: "The three servers the harvesters followed." },
  mastodon_rescored_histogram: {
    group: "Sentiment",
    title: "mastodon.social re-scored histogram",
    description: "The surviving May 2023 raw harvest re-scored with the original pipeline (aggregates only).",
  },
  mastodon_hourly: {
    group: "Sentiment",
    title: "mastodon.social by hour",
    description: "Toots per UTC hour with score sums and 1-9 bucket counts.",
  },
  mastodon_language: {
    group: "Sentiment",
    title: "mastodon.social by language",
    description: "Toots per declared language with score sums and bucket counts.",
  },
  regions_sal: {
    group: "Geography",
    title: "Suburbs and localities (SAL 2021)",
    description: "ABS SAL regions with tweets, a representative point and the SA2/LGA they fall in.",
  },
  regions_sa2: { group: "Geography", title: "Victorian SA2s (2016)", description: "ABS Statistical Area Level 2 regions in Victoria." },
  regions_lga: { group: "Geography", title: "Victorian LGAs (2019)", description: "ABS Local Government Areas in Victoria." },
  income_sa2: {
    group: "SUDO",
    title: "Personal income by SA2",
    description: "SUDO / ABS personal income 2015-16 (mean, median, sum, median age of earners) for every SA2.",
  },
  income_gcc: {
    group: "SUDO",
    title: "Personal income by capital city area",
    description: "The SA2 rows grouped by Greater Capital City Statistical Area, as in the original summary.",
  },
  jobs_income_indicators: {
    group: "SUDO",
    title: "Jobs and income by industry",
    description: "ABS Jobs in Australia indicators (mean, sd and median across SA2s) from the original bar chart.",
  },
  crime_lga: {
    group: "SUDO",
    title: "Recorded offences by LGA",
    description: "Victorian Crime Statistics Agency offence divisions per LGA (reference year 2019).",
  },
  scenario_income_sa2: {
    group: "Scenarios",
    title: "Scenario 1: income vs sentiment",
    description: "Median income joined with suburb tweet sentiment pooled to SA2 (revival analysis).",
  },
  scenario_crime_lga: {
    group: "Scenarios",
    title: "Scenario 2: crime vs sentiment",
    description: "Offence totals joined with suburb tweet sentiment pooled to LGA (revival analysis).",
  },
  scenario_correlations: {
    group: "Scenarios",
    title: "Scenario correlations",
    description: "Pearson, Spearman and least-squares fits at several minimum-tweet thresholds (scipy).",
  },
};

export interface TableInfo {
  name: string;
  rows: number;
  columns: { name: string; type: string }[];
}

export const listTables = cache(async (): Promise<TableInfo[]> => {
  const names = await query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const out: TableInfo[] = [];
  for (const { name } of names) {
    const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM "${name}"`);
    const cols = await query<{ name: string; type: string }>(`PRAGMA table_info("${name}")`);
    out.push({ name, rows: n, columns: cols.map((c) => ({ name: c.name, type: c.type || "TEXT" })) });
  }
  return out;
});

export async function getTable(name: string): Promise<TableInfo | null> {
  const tables = await listTables();
  return tables.find((t) => t.name === name) ?? null;
}

export const PAGE_SIZE = 25;

export const tableParamsSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  sort: z.string().max(64).optional(),
  dir: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type TableParams = z.infer<typeof tableParamsSchema>;

function whereClause(t: TableInfo, q: string): { sql: string; args: string[] } {
  if (!q) return { sql: "", args: [] };
  const parts = t.columns.map((c) => `CAST("${c.name}" AS TEXT) LIKE ? ESCAPE '\\'`);
  const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return { sql: `WHERE ${parts.join(" OR ")}`, args: t.columns.map(() => pattern) };
}

export async function queryTable(t: TableInfo, params: TableParams) {
  const where = whereClause(t, params.q);
  const sortCol = t.columns.find((c) => c.name === params.sort)?.name;
  const order = sortCol ? `ORDER BY "${sortCol}" ${params.dir === "desc" ? "DESC" : "ASC"}` : "ORDER BY rowid";
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM "${t.name}" ${where.sql}`, where.args);
  const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
  const page = Math.min(params.page, pages);
  const rows = await query<Record<string, string | number | null>>(
    `SELECT * FROM "${t.name}" ${where.sql} ${order} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    where.args,
  );
  return { rows, total: n, page, pages };
}

/** Every row of a table, optionally filtered, for CSV export. */
export async function allRows(t: TableInfo, q = "") {
  const where = whereClause(t, q);
  return query<Record<string, string | number | null>>(`SELECT * FROM "${t.name}" ${where.sql} ORDER BY rowid`, where.args);
}
