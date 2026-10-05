"use client";

import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  CircleSlash,
  KeyRound,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import { openAiSettings } from "@/components/ai/ai-settings-dialog";
import { AutoChart, ResultTable } from "@/components/ask/result-table";
import { Button } from "@/components/ui/button";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { appendEntry, type AuditEntry, type HumanDecision, newId, updateEntry } from "@/lib/ai/audit-log";
import { addUsage } from "@/lib/ai/client";
import { getKey } from "@/lib/ai/settings";
import {
  type CitationCheck,
  type ExplainReply,
  explainRows,
  generateSql,
  ROWS_SENT,
} from "@/lib/ai/text-to-sql";
import { AiError, modelFor, PROVIDER_LABEL, type TokenUsage } from "@/lib/ai/types";
import { runSql, type SqlRunResponse, verdictSummary } from "@/lib/sql/client";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Which five Victorian suburbs had the most crime-related tweets?",
  "What share of mastodon.social toots in each of the ten biggest languages scored a neutral 5?",
  "Which Victorian LGAs recorded more than 10,000 offences in 2019?",
  "How does median income compare between Greater Melbourne and the rest of Victoria?",
  "Which Twitter users were most negative about crime?",
];

type Step = "sql" | "run" | "explain" | null;

interface Flow {
  id: string;
  question: string;
  provider: AuditEntry["provider"];
  model: string;
  servedModel?: string;
  started: number;
  reply?: { answerable: boolean; sql: string; reason: string };
  modelMs?: number;
  run?: SqlRunResponse;
  sqlMs?: number;
  explain?: { data: ExplainReply; check: CitationCheck; ms: number };
  usage: TokenUsage | null;
  editedSql?: string;
  error?: string;
  decision: HumanDecision;
  logged: boolean;
}

function toEntry(f: Flow): AuditEntry {
  const total = Math.round(performance.now() - f.started);
  return {
    id: f.id,
    timestamp: new Date().toISOString(),
    feature: "ask-the-data",
    provider: f.provider,
    model: f.model,
    servedModel: f.servedModel,
    input: { question: f.question },
    output: {
      answerable: f.reply?.answerable,
      reason: f.reply?.reason,
      generatedSql: f.reply?.sql || undefined,
      editedSql: f.editedSql,
      answer: f.explain?.data.answer,
      caveat: f.explain?.data.caveat || undefined,
      citedRows: f.explain?.check.cited,
      grounded: f.explain?.check.grounded,
    },
    validation: f.run ? { verdict: f.run.verdict, issues: f.run.issues.map((i) => i.message) } : undefined,
    rowCount: f.run?.rowCount,
    latencyMs: { model: f.modelMs ?? 0, sql: f.sqlMs, explain: f.explain?.ms, total },
    usage: f.usage,
    decision: f.decision,
    error: f.error,
  };
}

export function AskData() {
  const { settings, hasKey } = useAiSettings();
  const [question, setQuestion] = useState("");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [sqlDraft, setSqlDraft] = useState("");
  const [highlight, setHighlight] = useState<Set<number>>(new Set());
  const [manual, setManual] = useState<SqlRunResponse | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = step !== null;

  const log = async (f: Flow) => {
    const key = getKey(f.provider);
    try {
      if (f.logged) await updateEntry(f.id, toEntry(f), [key]);
      else await appendEntry(toEntry(f), [key]);
      return { ...f, logged: true };
    } catch {
      return f; // IndexedDB unavailable (e.g. private mode): the feature still works
    }
  };

  /** Run SQL on the server, then (if there are rows) ask the model to explain them. */
  const runAndExplain = async (f: Flow, sql: string, signal: AbortSignal): Promise<Flow> => {
    setStep("run");
    const t0 = performance.now();
    const run = await runSql(sql, signal);
    f = { ...f, run, sqlMs: Math.round(performance.now() - t0), explain: undefined };
    setFlow(f);
    setHighlight(new Set());
    if (run.verdict !== "allowed" || run.rowCount === 0) return f;
    setStep("explain");
    try {
      const ex = await explainRows(
        f.question,
        run.sql,
        run.columns,
        run.rows,
        settings,
        getKey(settings.provider),
        {
          signal,
        },
      );
      return {
        ...f,
        explain: { data: ex.data, check: ex.check, ms: ex.latencyMs },
        usage: addUsage(f.usage, ex.usage),
        servedModel: ex.servedModel,
      };
    } catch (e) {
      return { ...f, error: `Explanation failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  };

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    if (!hasKey) {
      openAiSettings();
      return;
    }
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setManual(null);
    let f: Flow = {
      id: newId(),
      question: text,
      provider: settings.provider,
      model: modelFor(settings),
      started: performance.now(),
      usage: null,
      decision: "pending",
      logged: false,
    };
    setFlow(f);
    setStep("sql");
    try {
      const res = await generateSql(text, settings, getKey(settings.provider), { signal: ctl.signal });
      f = { ...f, reply: res.data, modelMs: res.latencyMs, usage: res.usage, servedModel: res.servedModel };
      setFlow(f);
      setSqlDraft(res.data.sql);
      if (res.data.answerable && res.data.sql.trim()) f = await runAndExplain(f, res.data.sql, ctl.signal);
    } catch (e) {
      f = { ...f, error: e instanceof AiError ? e.message : e instanceof Error ? e.message : String(e) };
    }
    setStep(null);
    f = await log(f);
    setFlow(f);
  };

  const rerun = async () => {
    if (!flow || busy || !sqlDraft.trim()) return;
    const ctl = new AbortController();
    abort.current = ctl;
    let f: Flow = { ...flow, editedSql: sqlDraft, decision: "edited", error: undefined };
    try {
      f = await runAndExplain(f, sqlDraft, ctl.signal);
    } catch (e) {
      f = { ...f, error: e instanceof Error ? e.message : String(e) };
    }
    setStep(null);
    f = await log(f);
    setFlow(f);
  };

  const decide = async (d: "accepted" | "rejected") => {
    if (!flow) return;
    const decision: HumanDecision = d === "accepted" && flow.editedSql ? "edited" : d;
    const f = await log({ ...flow, decision });
    setFlow(f);
  };

  const runManual = async () => {
    if (!sqlDraft.trim() || busy) return;
    setStep("run");
    setFlow(null);
    setManual(await runSql(sqlDraft));
    setStep(null);
  };

  const cite = (n: number) => {
    setHighlight(new Set([n]));
    document.getElementById(`ask-r${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const sqlEdited = !!flow?.reply && sqlDraft.trim() !== flow.reply.sql.trim();
  const run = flow?.run ?? manual;

  return (
    <div className="space-y-6">
      {/* ---- question ------------------------------------------------------------ */}
      <form
        className="border-border bg-card space-y-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="ask-q" className="text-sm font-medium">
          Your question
        </label>
        <textarea
          id="ask-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask(question);
          }}
          rows={2}
          maxLength={500}
          placeholder="e.g. Which Victorian suburbs had the most income-related tweets?"
          className="border-input bg-background focus-visible:ring-ring/40 w-full resize-y rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
        <div className="flex flex-wrap gap-1.5" aria-label="Example questions">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="border-border text-muted-foreground hover:text-foreground hover:border-primary/60 rounded-full border px-2.5 py-1 text-left text-xs"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-muted-foreground text-xs">
            {hasKey ? (
              <>
                Using <strong className="text-foreground">{PROVIDER_LABEL[settings.provider]}</strong> ·{" "}
                <code>{modelFor(settings)}</code> with your key.{" "}
                <button type="button" className="link" onClick={openAiSettings}>
                  Change
                </button>
              </>
            ) : (
              <>No key set: add your own to ask in plain English, or write SQL yourself below.</>
            )}
          </p>
          <div className="flex gap-2">
            {busy && (
              <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
                Cancel
              </Button>
            )}
            {hasKey ? (
              <Button type="submit" disabled={busy || !question.trim()}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} Ask
              </Button>
            ) : (
              <Button type="button" onClick={openAiSettings}>
                <KeyRound aria-hidden /> Add your key
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* ---- the steps ------------------------------------------------------------ */}
      {flow && (
        <ol className="space-y-5" aria-live="polite">
          <StepCard
            n={1}
            title="Your model writes one SQL query"
            where={`in your browser → ${PROVIDER_LABEL[flow.provider]}`}
            state={step === "sql" ? "running" : flow.reply ? "done" : flow.error ? "failed" : "waiting"}
          >
            {step === "sql" && <p className="text-muted-foreground text-sm">Waiting for {flow.model}…</p>}
            {flow.reply && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AiGeneratedLabel model={flow.servedModel ?? flow.model} />
                  <span className="num text-muted-foreground text-xs">{flow.modelMs} ms</span>
                </div>
                {flow.reply.answerable ? (
                  <>
                    <p className="text-sm">{flow.reply.reason}</p>
                    <label htmlFor="ask-sql" className="text-muted-foreground block text-xs font-medium">
                      SQL (you can edit it and run it again)
                    </label>
                    <textarea
                      id="ask-sql"
                      value={sqlDraft}
                      onChange={(e) => setSqlDraft(e.target.value)}
                      rows={Math.min(
                        12,
                        Math.max(3, sqlDraft.split("\n").length + Math.ceil(sqlDraft.length / 45)),
                      )}
                      spellCheck={false}
                      className="border-input bg-background focus-visible:ring-ring/40 w-full rounded-md border px-3 py-2 font-mono text-xs leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
                    />
                    {sqlEdited && (
                      <Button size="sm" variant="secondary" onClick={() => void rerun()} disabled={busy}>
                        <RotateCcw aria-hidden /> Run edited SQL
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="border-border bg-muted/40 flex gap-2 rounded-md border p-3 text-sm">
                    <CircleSlash className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                    <p>
                      <strong>Not answerable from this database.</strong> {flow.reply.reason}
                    </p>
                  </div>
                )}
              </div>
            )}
            {!flow.reply && flow.error && <ErrorNote message={flow.error} />}
          </StepCard>

          {flow.reply?.answerable && (
            <StepCard
              n={2}
              title="This site's server checks the SQL and runs it read-only"
              where="server: validator → SQLite (query_only, 2.5 s limit)"
              state={
                step === "run"
                  ? "running"
                  : flow.run
                    ? flow.run.verdict === "allowed"
                      ? "done"
                      : "failed"
                    : "waiting"
              }
            >
              {flow.run && <Verdict run={flow.run} ms={flow.sqlMs} />}
            </StepCard>
          )}

          {flow.run?.verdict === "allowed" && (
            <StepCard
              n={3}
              title="Your model explains the rows, citing them"
              where={`in your browser → ${PROVIDER_LABEL[flow.provider]} (question, SQL and up to ${ROWS_SENT} rows)`}
              state={
                step === "explain"
                  ? "running"
                  : flow.explain
                    ? flow.explain.check.grounded
                      ? "done"
                      : "warning"
                    : flow.run.rowCount === 0
                      ? "skipped"
                      : flow.error
                        ? "failed"
                        : "waiting"
              }
            >
              {flow.run.rowCount === 0 && (
                <p className="text-muted-foreground text-sm">
                  No rows came back, so there is nothing to explain.
                </p>
              )}
              {flow.explain && (
                <Answer explain={flow.explain} model={flow.servedModel ?? flow.model} onCite={cite} />
              )}
              {!flow.explain && flow.error && <ErrorNote message={flow.error} />}
            </StepCard>
          )}

          {!busy && (
            <li className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="text-sm">
                <p className="font-medium">Your call</p>
                <p className="text-muted-foreground text-xs">
                  Recorded in the{" "}
                  <Link className="link" href="/ai-log">
                    audit log
                  </Link>{" "}
                  (this browser only): <strong className="text-foreground">{flow.decision}</strong>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={flow.decision === "accepted" || flow.decision === "edited" ? "default" : "outline"}
                  onClick={() => void decide("accepted")}
                >
                  <ThumbsUp aria-hidden /> Accept
                </Button>
                <Button
                  size="sm"
                  variant={flow.decision === "rejected" ? "destructive" : "outline"}
                  onClick={() => void decide("rejected")}
                >
                  <ThumbsDown aria-hidden /> Reject
                </Button>
              </div>
            </li>
          )}
        </ol>
      )}

      {/* ---- results ------------------------------------------------------------- */}
      {run?.verdict === "allowed" && run.rowCount > 0 && (
        <section className="space-y-4" aria-label="Query results">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-xl font-semibold">Result</h3>
            <p className="num text-muted-foreground text-xs">
              {run.rowCount} row{run.rowCount === 1 ? "" : "s"}
              {run.truncated ? ` (capped at ${run.rowCount}; the query returned more)` : ""} · tables:{" "}
              {run.tables.join(", ")}
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <ResultTable
              columns={run.columns}
              rows={run.rows}
              highlighted={highlight}
              idPrefix="ask"
              caption="Rows returned by the query"
            />
            <div className="border-border bg-card rounded-lg border p-4">
              <p className="text-muted-foreground mb-3 text-xs font-medium">Automatic chart</p>
              <AutoChart columns={run.columns} rows={run.rows} />
            </div>
          </div>
        </section>
      )}
      {manual && manual.verdict !== "allowed" && <Verdict run={manual} />}

      {/* ---- no-key path ------------------------------------------------------------ */}
      {!flow && (
        <details className="border-border bg-card group rounded-lg border p-4" open={!hasKey}>
          <summary className="cursor-pointer text-sm font-medium">
            Write SQL yourself (no AI, no key needed)
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-muted-foreground text-xs">
              The same validator and read-only runner the AI path uses. Tables and columns are listed below.
            </p>
            <textarea
              aria-label="SQL query"
              value={sqlDraft}
              onChange={(e) => setSqlDraft(e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="SELECT lga_name, total FROM crime_lga ORDER BY total DESC LIMIT 10"
              className="border-input bg-background focus-visible:ring-ring/40 w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void runManual()}
              disabled={busy || !sqlDraft.trim()}
            >
              <Play aria-hidden /> Run
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}

type StepState = "waiting" | "running" | "done" | "failed" | "warning" | "skipped";

function StepCard({
  n,
  title,
  where,
  state,
  children,
}: {
  n: number;
  title: string;
  where: string;
  state: StepState;
  children?: React.ReactNode;
}) {
  const icon = {
    waiting: <span className="num text-xs">{n}</span>,
    running: <Loader2 className="size-4 animate-spin" aria-hidden />,
    done: <Check className="size-4" aria-hidden />,
    failed: <Ban className="size-4" aria-hidden />,
    warning: <AlertTriangle className="size-4" aria-hidden />,
    skipped: <CircleSlash className="size-4" aria-hidden />,
  }[state];
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3">
      <span
        className={cn(
          "border-border bg-card grid size-8 place-items-center rounded-full border font-serif",
          state === "done" && "border-sent-pos text-sent-pos",
          (state === "failed" || state === "warning") && "border-sent-neg text-sent-neg",
        )}
        aria-label={`Step ${n}: ${state}`}
      >
        {icon}
      </span>
      <div className="border-border bg-card min-w-0 rounded-lg border p-4">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mb-3 text-xs">{where}</p>
        {children}
      </div>
    </li>
  );
}

function Verdict({ run, ms }: { run: SqlRunResponse; ms?: number }) {
  if (run.verdict === "allowed")
    return (
      <div className="space-y-2 text-sm">
        <p className="text-sent-pos flex items-start gap-1.5 font-medium">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Allowed and run · {run.rowCount} row{run.rowCount === 1 ? "" : "s"}
            {ms !== undefined && (
              <span className="num text-muted-foreground font-normal"> · {ms} ms round trip</span>
            )}
          </span>
        </p>
        <p className="text-muted-foreground text-xs">
          One SELECT on {run.tables.join(", ") || "no table"};{" "}
          {run.limitApplied ? "row cap applied" : "its own LIMIT kept"}.
        </p>
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer">What the database executed</summary>
          <pre className="bg-muted/60 mt-2 overflow-x-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
            {run.executedSql}
          </pre>
        </details>
      </div>
    );
  return (
    <div className="space-y-2 text-sm" role="alert">
      <p className="text-sent-neg flex items-center gap-1.5 font-medium">
        <Ban className="size-4" aria-hidden />
        {run.verdict === "blocked" ? "Blocked by the validator, not run" : "Not completed"}
      </p>
      <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
        {run.issues.map((i, k) => (
          <li key={k}>
            <code>{i.code}</code>: {i.message}
          </li>
        ))}
        {run.error && <li>{run.error.message}</li>}
        {run.message && <li>{run.message}</li>}
      </ul>
      <p className="text-muted-foreground text-[11px]">{verdictSummary(run)}</p>
    </div>
  );
}

function Answer({
  explain,
  model,
  onCite,
}: {
  explain: { data: ExplainReply; check: CitationCheck; ms: number };
  model: string;
  onCite: (n: number) => void;
}) {
  const parts = explain.data.answer.split(/(\[r\d+\])/g);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AiGeneratedLabel model={model} />
        <span className="num text-muted-foreground text-xs">{explain.ms} ms</span>
      </div>
      <p className="prose-civic text-[1.02rem]">
        {parts.map((p, i) => {
          const m = /^\[r(\d+)\]$/.exec(p);
          if (!m) return <span key={i}>{p}</span>;
          const n = Number(m[1]);
          const valid = explain.check.cited.includes(n);
          return (
            <button
              key={i}
              type="button"
              onClick={() => valid && onCite(n)}
              className={cn(
                "num mx-0.5 rounded px-1 align-baseline font-mono text-[11px]",
                valid
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "bg-sent-neg/15 text-sent-neg line-through",
              )}
              aria-label={valid ? `Show row ${n}` : `Row ${n} does not exist`}
            >
              r{n}
            </button>
          );
        })}
      </p>
      {explain.data.caveat && <p className="text-muted-foreground text-xs">Caveat: {explain.data.caveat}</p>}
      {explain.check.grounded ? (
        <p className="text-sent-pos flex items-start gap-1.5 text-xs">
          <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Cites returned rows {explain.check.cited.map((c) => `r${c}`).join(", ")}. Check them against the
            table before relying on the sentence.
          </span>
        </p>
      ) : (
        <p className="text-sent-neg flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          {explain.check.invalid.length
            ? `Cites rows that were not returned (${explain.check.invalid.map((c) => `r${c}`).join(", ")}): treat the answer as unreliable.`
            : "Does not cite the returned rows: treat the answer as unverified."}
        </p>
      )}
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="text-sent-neg flex items-start gap-1.5 text-sm" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
