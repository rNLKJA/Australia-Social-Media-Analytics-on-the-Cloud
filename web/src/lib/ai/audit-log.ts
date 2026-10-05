/**
 * The AI audit log: one record per AI interaction, kept in the visitor's own
 * browser (IndexedDB), viewable and exportable at /ai-log. The site is static
 * and has no accounts, so there is no server-side copy; that is deliberate
 * (see docs/decisions/DR-004).
 *
 * A record holds what was asked, which provider and model answered, what came
 * back, what the server's SQL validator decided, how long it took, the token
 * usage the provider reported and what the human did with it. It never holds
 * the API key: `redactSecrets` strips the active key and anything shaped like
 * a provider key before every write.
 *
 * Records are append-only for the AI fields: once written, only the human
 * decision (`decision`, `decidedAt`) is ever updated. Running edited SQL
 * appends a new record that points at the original through `parentId`.
 */
import { toCsv } from "@/lib/csv";
import { AUDIT_STORE, tx } from "./idb";
import type { Provider, TokenUsage } from "./types";

export type AuditFeature = "ask-the-data" | "text-to-sql-eval";
export type HumanDecision = "pending" | "accepted" | "edited" | "rejected" | "not-applicable";

export interface AuditEntry {
  id: string;
  /** the record this one re-runs with SQL a person edited */
  parentId?: string;
  /** ISO 8601, when the interaction started; never changed afterwards */
  timestamp: string;
  feature: AuditFeature;
  provider: Provider;
  /** model id requested */
  model: string;
  /** model id the provider reported serving */
  servedModel?: string;
  input: {
    question: string;
    benchmarkId?: string;
    runId?: string;
    /** what the explanation call was given besides the question: the SQL and how many rows */
    explainInput?: { sql: string; rowsSent: number };
  };
  output: {
    answerable?: boolean;
    reason?: string;
    /** SQL as the model wrote it */
    generatedSql?: string;
    /** SQL as finally run, if a person edited it */
    editedSql?: string;
    answer?: string;
    caveat?: string;
    citedRows?: number[];
    grounded?: boolean;
    /** benchmark scoring */
    score?: string;
  };
  validation?: { verdict: string; issues: string[] };
  rowCount?: number;
  /** measured once when the interaction finished; `model` is the SQL-writing call */
  latencyMs: { model?: number; sql?: number; explain?: number; total: number };
  usage?: TokenUsage | null;
  decision: HumanDecision;
  /** ISO 8601, when the person made the decision */
  decidedAt?: string;
  error?: string;
}

/** The only change a record accepts after it is written: the human decision. */
export function decisionPatch(
  decision: HumanDecision,
  at: Date = new Date(),
): Pick<AuditEntry, "decision" | "decidedAt"> {
  return { decision, decidedAt: at.toISOString() };
}

/** Anything shaped like an Anthropic or OpenAI secret key. */
const KEY_PATTERN = /\b(sk-ant-[A-Za-z0-9_-]{8,}|sk-(proj-|svcacct-)?[A-Za-z0-9_-]{16,})/g;

/** Remove `secrets` (and any provider-key-shaped string) from a record before it is stored. */
export function redactSecrets<T>(value: T, secrets: (string | null | undefined)[] = []): T {
  let json = JSON.stringify(value);
  for (const s of secrets) {
    if (s && s.length >= 8) json = json.split(JSON.stringify(s).slice(1, -1)).join("[redacted]");
  }
  json = json.replace(KEY_PATTERN, "[redacted]");
  return JSON.parse(json) as T;
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const listeners = new Set<() => void>();
export function onAuditChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
const changed = () => listeners.forEach((l) => l());

/** Append a record (redacted). */
export async function appendEntry(entry: AuditEntry, secrets: (string | null)[] = []): Promise<void> {
  await tx(AUDIT_STORE, "readwrite", (s) => s.put(redactSecrets(entry, secrets)));
  changed();
}

/** Record the human decision on a stored record. Nothing else about it can change. */
export async function updateEntry(
  id: string,
  patch: Pick<AuditEntry, "decision" | "decidedAt">,
): Promise<void> {
  const current = (await tx<AuditEntry>(AUDIT_STORE, "readonly", (s) => s.get(id))) as AuditEntry | undefined;
  if (!current) return;
  const next: AuditEntry = { ...current, decision: patch.decision, decidedAt: patch.decidedAt };
  await tx(AUDIT_STORE, "readwrite", (s) => s.put(next));
  changed();
}

/** All records, newest first. */
export async function listEntries(): Promise<AuditEntry[]> {
  const all = ((await tx<AuditEntry[]>(AUDIT_STORE, "readonly", (s) => s.getAll())) ?? []) as AuditEntry[];
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function clearEntries(): Promise<void> {
  await tx(AUDIT_STORE, "readwrite", (s) => s.clear());
  changed();
}

export const CSV_COLUMNS = [
  "id",
  "parent_id",
  "timestamp",
  "feature",
  "provider",
  "model",
  "served_model",
  "question",
  "benchmark_id",
  "answerable",
  "generated_sql",
  "edited_sql",
  "validation_verdict",
  "validation_issues",
  "row_count",
  "answer",
  "cited_rows",
  "grounded",
  "score",
  "latency_ms",
  "model_latency_ms",
  "input_tokens",
  "output_tokens",
  "decision",
  "decided_at",
  "error",
] as const;

export function entriesToCsv(entries: AuditEntry[]): string {
  return toCsv(
    [...CSV_COLUMNS],
    entries.map((e) => ({
      id: e.id,
      parent_id: e.parentId ?? "",
      timestamp: e.timestamp,
      feature: e.feature,
      provider: e.provider,
      model: e.model,
      served_model: e.servedModel ?? "",
      question: e.input.question,
      benchmark_id: e.input.benchmarkId ?? "",
      answerable: e.output.answerable ?? "",
      generated_sql: e.output.generatedSql ?? "",
      edited_sql: e.output.editedSql ?? "",
      validation_verdict: e.validation?.verdict ?? "",
      validation_issues: e.validation?.issues.join("; ") ?? "",
      row_count: e.rowCount ?? "",
      answer: e.output.answer ?? "",
      cited_rows: e.output.citedRows?.join(" ") ?? "",
      grounded: e.output.grounded ?? "",
      score: e.output.score ?? "",
      latency_ms: e.latencyMs.total,
      model_latency_ms: e.latencyMs.model ?? "",
      input_tokens: e.usage?.inputTokens ?? "",
      output_tokens: e.usage?.outputTokens ?? "",
      decision: e.decision,
      decided_at: e.decidedAt ?? "",
      error: e.error ?? "",
    })),
  );
}

export function entriesToJson(entries: AuditEntry[]): string {
  return JSON.stringify(
    { exported: new Date().toISOString(), source: "Social Sense AI audit log (this browser only)", entries },
    null,
    2,
  );
}
