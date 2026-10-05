import { z } from "zod";

/** Browser side of POST /api/sql: send SQL (and nothing else), get the verdict and rows back. */

const cell = z.union([z.string(), z.number(), z.null()]);

export const sqlRunResponseSchema = z.object({
  verdict: z.enum(["allowed", "blocked", "error", "rejected"]),
  issues: z.array(z.object({ code: z.string(), message: z.string() })).default([]),
  sql: z.string().default(""),
  executedSql: z.string().nullable().default(null),
  limitApplied: z.boolean().default(false),
  tables: z.array(z.string()).default([]),
  columns: z.array(z.string()).default([]),
  rows: z.array(z.array(cell)).default([]),
  rowCount: z.number().default(0),
  truncated: z.boolean().default(false),
  elapsedMs: z.number().default(0),
  error: z.object({ code: z.string(), message: z.string() }).nullable().default(null),
  message: z.string().optional(),
});

export type SqlRunResponse = z.infer<typeof sqlRunResponseSchema>;

export async function runSql(
  sql: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<SqlRunResponse> {
  let res: Response;
  try {
    res = await fetchImpl("/api/sql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sql }),
      signal,
    });
  } catch {
    return sqlRunResponseSchema.parse({
      verdict: "error",
      sql,
      error: { code: "network", message: "Could not reach this site's query endpoint." },
    });
  }
  try {
    return sqlRunResponseSchema.parse(await res.json());
  } catch {
    return sqlRunResponseSchema.parse({
      verdict: "error",
      sql,
      error: { code: "server", message: `Unexpected response (${res.status}).` },
    });
  }
}

/** One-line description of a verdict for logs and tables. */
export function verdictSummary(r: SqlRunResponse): string {
  if (r.verdict === "allowed") return `allowed${r.limitApplied ? ", row cap applied" : ""}`;
  if (r.verdict === "blocked") return `blocked: ${r.issues.map((i) => i.code).join(", ")}`;
  return `error: ${r.error?.message ?? r.message ?? "unknown"}`;
}
