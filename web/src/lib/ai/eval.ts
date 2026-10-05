/**
 * Scoring and summarising text-to-SQL benchmark runs. Pure functions (the
 * run loop lives in the eval page); persistence of runs is in this browser's
 * IndexedDB like the audit log.
 */
import { toCsv } from "@/lib/csv";
import type { BenchmarkItem } from "@/lib/sql/benchmark";
import { resultsMatch, type ResultSet } from "@/lib/sql/compare";
import type { SqlRunResponse } from "@/lib/sql/client";
import {
  mcnemarExact,
  type McNemarResult,
  medianBootstrap,
  type ProportionInterval,
  wilson,
} from "@/lib/stats";
import { EVAL_STORE, tx } from "./idb";
import type { Provider, TokenUsage } from "./types";

export type ItemStatus =
  | "correct" // answerable: result matched the gold result
  | "wrong" // answerable: ran, different result
  | "blocked" // answerable: the server's validator refused the SQL
  | "sql_error" // answerable: passed validation, failed in SQLite (or timed out)
  | "refused" // answerable: the model said it could not answer
  | "correct_refusal" // unanswerable: the model refused
  | "missed_refusal" // unanswerable: the model produced SQL anyway
  | "ai_error"; // the provider call failed (key, rate limit, network, invalid output)

export const STATUS_LABEL: Record<ItemStatus, string> = {
  correct: "Correct",
  wrong: "Wrong result",
  blocked: "Blocked by validator",
  sql_error: "SQL error",
  refused: "Refused (answerable)",
  correct_refusal: "Correct refusal",
  missed_refusal: "Should have refused",
  ai_error: "Provider error",
};

export interface EvalItemResult {
  id: string;
  question: string;
  status: ItemStatus;
  detail: string;
  sql: string;
  verdict: string;
  latencyMs: number | null;
  usage: TokenUsage | null;
}

export interface EvalRun {
  id: string;
  /** ISO 8601 */
  timestamp: string;
  provider: Provider;
  model: string;
  /** 1-based repetition number within a batch of repeated runs */
  repetition: number;
  batchId: string;
  results: EvalItemResult[];
}

export function scoreItem(
  item: BenchmarkItem,
  reply: { answerable: boolean; sql: string } | null,
  run: SqlRunResponse | null,
  gold: ResultSet | null,
  aiError?: string,
): Pick<EvalItemResult, "status" | "detail"> {
  if (aiError || !reply) return { status: "ai_error", detail: aiError ?? "no reply" };
  if (!item.goldSql) {
    return reply.answerable && reply.sql.trim()
      ? { status: "missed_refusal", detail: "produced SQL for a question the data cannot answer" }
      : { status: "correct_refusal", detail: "declined" };
  }
  if (!reply.answerable || !reply.sql.trim())
    return { status: "refused", detail: "declined an answerable question" };
  if (!run) return { status: "sql_error", detail: "not run" };
  if (run.verdict === "blocked")
    return { status: "blocked", detail: run.issues.map((i) => i.message).join(" ") };
  if (run.verdict !== "allowed")
    return { status: "sql_error", detail: run.error?.message ?? run.message ?? "error" };
  if (!gold) return { status: "sql_error", detail: "no gold result" };
  const m = resultsMatch(gold, run);
  return m.match ? { status: "correct", detail: m.reason } : { status: "wrong", detail: m.reason };
}

export interface RunSummary {
  questions: number;
  /** execution accuracy on answerable questions */
  accuracy: ProportionInterval;
  /** refusals on the unanswerable questions */
  refusal: ProportionInterval;
  /** validator-blocked or SQLite-failed SQL, among answerable questions where SQL was produced */
  invalidSql: ProportionInterval;
  aiErrors: number;
  latency: { median: number; lower: number; upper: number; n: number } | null;
  tokens: { input: number; output: number; perQuestion: number } | null;
}

export function summariseRun(results: EvalItemResult[], answerableIds: Set<string>): RunSummary {
  const ans = results.filter((r) => answerableIds.has(r.id));
  const unans = results.filter((r) => !answerableIds.has(r.id));
  const scorable = ans.filter((r) => r.status !== "ai_error");
  const produced = scorable.filter((r) => r.status !== "refused");
  const lat = results.map((r) => r.latencyMs).filter((v): v is number => v !== null);
  const used = results.map((r) => r.usage).filter((u): u is TokenUsage => !!u);
  const boot = lat.length >= 3 ? medianBootstrap(lat, { B: 2000 }) : null;
  const tokIn = used.reduce((a, u) => a + u.inputTokens, 0);
  const tokOut = used.reduce((a, u) => a + u.outputTokens, 0);
  return {
    questions: results.length,
    accuracy: wilson(scorable.filter((r) => r.status === "correct").length, scorable.length),
    refusal: wilson(
      unans.filter((r) => r.status === "correct_refusal").length,
      unans.filter((r) => r.status !== "ai_error").length,
    ),
    invalidSql: wilson(
      produced.filter((r) => r.status === "blocked" || r.status === "sql_error").length,
      produced.length,
    ),
    aiErrors: results.filter((r) => r.status === "ai_error").length,
    latency: boot ? { median: boot.estimate, lower: boot.lower, upper: boot.upper, n: lat.length } : null,
    tokens: used.length
      ? { input: tokIn, output: tokOut, perQuestion: (tokIn + tokOut) / used.length }
      : null,
  };
}

export interface PairedComparison {
  pairs: number;
  bothCorrect: number;
  onlyA: number;
  onlyB: number;
  neither: number;
  /** accuracy of A minus accuracy of B on the paired questions */
  difference: number;
  mcnemar: McNemarResult;
}

/** Paired comparison of two runs on the answerable questions both scored. */
export function compareRuns(a: EvalRun, b: EvalRun, answerableIds: Set<string>): PairedComparison {
  const bById = new Map(b.results.map((r) => [r.id, r]));
  let both = 0;
  let onlyA = 0;
  let onlyB = 0;
  let neither = 0;
  for (const ra of a.results) {
    if (!answerableIds.has(ra.id)) continue;
    const rb = bById.get(ra.id);
    if (!rb || ra.status === "ai_error" || rb.status === "ai_error") continue;
    const ca = ra.status === "correct";
    const cb = rb.status === "correct";
    if (ca && cb) both++;
    else if (ca) onlyA++;
    else if (cb) onlyB++;
    else neither++;
  }
  const pairs = both + onlyA + onlyB + neither;
  return {
    pairs,
    bothCorrect: both,
    onlyA,
    onlyB,
    neither,
    difference: pairs ? (onlyA - onlyB) / pairs : 0,
    mcnemar: mcnemarExact(onlyA, onlyB),
  };
}

export function runsToCsv(runs: EvalRun[]): string {
  return toCsv(
    [
      "run_id",
      "batch_id",
      "repetition",
      "timestamp",
      "provider",
      "model",
      "question_id",
      "question",
      "status",
      "detail",
      "sql",
      "verdict",
      "latency_ms",
      "input_tokens",
      "output_tokens",
    ],
    runs.flatMap((run) =>
      run.results.map((r) => ({
        run_id: run.id,
        batch_id: run.batchId,
        repetition: run.repetition,
        timestamp: run.timestamp,
        provider: run.provider,
        model: run.model,
        question_id: r.id,
        question: r.question,
        status: r.status,
        detail: r.detail,
        sql: r.sql,
        verdict: r.verdict,
        latency_ms: r.latencyMs ?? "",
        input_tokens: r.usage?.inputTokens ?? "",
        output_tokens: r.usage?.outputTokens ?? "",
      })),
    ),
  );
}

export async function saveRun(run: EvalRun): Promise<void> {
  await tx(EVAL_STORE, "readwrite", (s) => s.put(run));
}

export async function listRuns(): Promise<EvalRun[]> {
  const all = ((await tx<EvalRun[]>(EVAL_STORE, "readonly", (s) => s.getAll())) ?? []) as EvalRun[];
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function deleteRuns(): Promise<void> {
  await tx(EVAL_STORE, "readwrite", (s) => s.clear());
}
