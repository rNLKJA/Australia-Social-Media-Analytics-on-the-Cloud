/**
 * The audit record behind one "Ask the data" interaction. Kept apart from the
 * component so the record's integrity rules are unit tested:
 *
 *  - `timestamp` is when the question was asked and `latencyMs.total` is the
 *    end-to-end time, both fixed when the interaction finishes; a later human
 *    decision never changes them (see `decisionPatch` in audit-log.ts);
 *  - running edited SQL is a new interaction with its own record, linked to
 *    the original by `parentId`, so the model's first answer is never
 *    overwritten.
 */
import type { SqlRunResponse } from "@/lib/sql/client";
import { type AuditEntry, type HumanDecision, newId } from "./audit-log";
import type { CitationCheck, ExplainReply } from "./text-to-sql";
import type { Provider, TokenUsage } from "./types";

export interface AskFlow {
  id: string;
  /** set on a re-run of edited SQL: the record it re-runs */
  parentId?: string;
  /** ISO 8601, when the question (or the re-run) started */
  timestamp: string;
  question: string;
  provider: Provider;
  model: string;
  servedModel?: string;
  /** performance.now() at the start */
  started: number;
  /** end-to-end time, set once when the interaction finishes */
  totalMs?: number;
  /** the model's SQL reply (on a re-run, the original reply, kept for display only) */
  reply?: { answerable: boolean; sql: string; reason: string };
  /** time of the SQL-writing call (on a re-run, the original call's, for display only) */
  modelMs?: number;
  run?: SqlRunResponse;
  sqlMs?: number;
  explain?: { data: ExplainReply; check: CitationCheck; ms: number; sql: string; rowsSent: number };
  /** tokens of the calls made in this interaction only */
  usage: TokenUsage | null;
  editedSql?: string;
  error?: string;
  /** AiError kind when a model call failed */
  errorKind?: string;
  decision: HumanDecision;
  decidedAt?: string;
  logged: boolean;
}

export function startFlow(
  question: string,
  provider: Provider,
  model: string,
  clock: { now: number; date: Date },
): AskFlow {
  return {
    id: newId(),
    timestamp: clock.date.toISOString(),
    question,
    provider,
    model,
    started: clock.now,
    usage: null,
    decision: "pending",
    logged: false,
  };
}

/** A new interaction that runs SQL a person edited, explained afresh, linked to `prev`. */
export function rerunFlow(prev: AskFlow, sql: string, clock: { now: number; date: Date }): AskFlow {
  return {
    ...prev,
    id: newId(),
    parentId: prev.parentId ?? prev.id,
    timestamp: clock.date.toISOString(),
    started: clock.now,
    totalMs: undefined,
    run: undefined,
    sqlMs: undefined,
    explain: undefined,
    usage: null,
    editedSql: sql,
    error: undefined,
    errorKind: undefined,
    decision: "pending",
    decidedAt: undefined,
    logged: false,
  };
}

/** Fix the end-to-end time once, when the interaction finishes. */
export function finishFlow(f: AskFlow, now: number): AskFlow {
  return f.totalMs === undefined ? { ...f, totalMs: Math.round(now - f.started) } : f;
}

/** True when there is an AI output a person can judge. */
export function hasAiOutput(f: AskFlow): boolean {
  return f.parentId ? !!f.explain : !!f.reply;
}

export function toEntry(f: AskFlow): AuditEntry {
  const rerun = !!f.parentId;
  return {
    id: f.id,
    parentId: f.parentId,
    timestamp: f.timestamp,
    feature: "ask-the-data",
    provider: f.provider,
    model: f.model,
    servedModel: f.servedModel,
    input: {
      question: f.question,
      explainInput: f.explain ? { sql: f.explain.sql, rowsSent: f.explain.rowsSent } : undefined,
    },
    output: {
      // a re-run makes no SQL-writing call, so it carries none of that call's output
      answerable: rerun ? undefined : f.reply?.answerable,
      reason: rerun ? undefined : f.reply?.reason,
      generatedSql: rerun ? undefined : f.reply?.sql || undefined,
      editedSql: f.editedSql,
      answer: f.explain?.data.answer,
      caveat: f.explain?.data.caveat || undefined,
      citedRows: f.explain?.check.cited,
      grounded: f.explain?.check.grounded,
    },
    validation: f.run ? { verdict: f.run.verdict, issues: f.run.issues.map((i) => i.message) } : undefined,
    rowCount: f.run?.rowCount,
    latencyMs: {
      model: rerun ? undefined : f.modelMs,
      sql: f.sqlMs,
      explain: f.explain?.ms,
      total: f.totalMs ?? 0,
    },
    usage: f.usage,
    decision: f.decision,
    decidedAt: f.decidedAt,
    error: f.error,
  };
}
