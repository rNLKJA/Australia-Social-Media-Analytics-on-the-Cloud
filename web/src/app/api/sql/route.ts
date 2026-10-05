import { z } from "zod";
import { runGuardedQuery } from "@/server/sql/execute";
import { MAX_SQL_CHARS } from "@/server/sql/guard";

/**
 * POST /api/sql  { "sql": "SELECT ..." }
 *
 * Validates and runs one read-only SELECT against analytics.db. This is the
 * only server endpoint the "Ask the data" feature uses, and it only ever
 * receives SQL: the visitor's AI key stays in their browser. Requests that
 * carry anything else (an API key header, extra JSON fields) are refused
 * rather than silently ignored. Nothing about the request is logged.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const MAX_BODY_BYTES = 16 * 1024;

const bodySchema = z.object({ sql: z.string().max(MAX_SQL_CHARS + 200) }).strict();

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function POST(request: Request) {
  if (request.headers.has("x-api-key") || request.headers.has("authorization"))
    return json(
      {
        verdict: "rejected",
        message:
          "This endpoint never accepts API keys. Your key is only ever sent from your browser to your AI provider.",
      },
      400,
    );
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return json({ verdict: "rejected", message: "Request too large." }, 413);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES)
      return json({ verdict: "rejected", message: "Request too large." }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ verdict: "rejected", message: 'Send JSON: { "sql": "SELECT ..." }.' }, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return json({ verdict: "rejected", message: 'The body must be exactly { "sql": string }.' }, 400);

  const outcome = await runGuardedQuery(parsed.data.sql);
  const { guard } = outcome;
  const payload = {
    verdict: outcome.verdict,
    issues: guard.issues,
    sql: guard.sql,
    executedSql: guard.executedSql,
    limitApplied: guard.limitApplied,
    tables: guard.tables,
    columns: outcome.columns,
    rows: outcome.rows,
    rowCount: outcome.rowCount,
    truncated: outcome.truncated,
    elapsedMs: outcome.elapsedMs,
    error: outcome.error ?? null,
  };
  const status =
    outcome.verdict === "allowed"
      ? 200
      : outcome.verdict === "blocked"
        ? 422
        : outcome.error?.code === "timeout"
          ? 504
          : outcome.error?.code === "too_large"
            ? 413
            : 400;
  return json(payload, status);
}
