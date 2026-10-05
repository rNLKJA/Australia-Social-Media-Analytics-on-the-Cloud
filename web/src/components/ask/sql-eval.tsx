"use client";

import { Download, KeyRound, Loader2, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import { openAiSettings } from "@/components/ai/ai-settings-dialog";
import { Button } from "@/components/ui/button";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { useAiSettings } from "@/hooks/use-ai-settings";
import { appendEntry, newId } from "@/lib/ai/audit-log";
import {
  compareRuns,
  deleteRuns,
  type EvalItemResult,
  type EvalRun,
  type ItemStatus,
  listRuns,
  runsToCsv,
  saveRun,
  scoreItem,
  STATUS_LABEL,
  summariseRun,
} from "@/lib/ai/eval";
import { getKey } from "@/lib/ai/settings";
import { generateSql } from "@/lib/ai/text-to-sql";
import { AiError, modelFor, PROVIDER_LABEL, type TokenUsage } from "@/lib/ai/types";
import { BENCHMARK } from "@/lib/sql/benchmark";
import { runSql, verdictSummary } from "@/lib/sql/client";
import type { ResultSet } from "@/lib/sql/compare";
import type { ProportionInterval } from "@/lib/stats";
import { cn } from "@/lib/utils";

const ANSWERABLE = new Set(BENCHMARK.filter((b) => b.goldSql).map((b) => b.id));

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
/** signed percentage points, with a true minus sign */
const pts = (x: number) => {
  const v = Math.round(x * 100);
  return v < 0 ? `−${-v}` : v > 0 ? `+${v}` : "0";
};
function fmtProp(p: ProportionInterval) {
  if (!p.n) return "–";
  return `${p.k}/${p.n} = ${pct(p.estimate)} [${pct(p.lower)}, ${pct(p.upper)}]`;
}

const STATUS_TONE: Record<ItemStatus, string> = {
  correct: "text-sent-pos-ink",
  correct_refusal: "text-sent-pos-ink",
  wrong: "text-sent-neg-ink",
  blocked: "text-sent-neg-ink",
  sql_error: "text-sent-neg-ink",
  refused: "text-sent-neg-ink",
  missed_refusal: "text-sent-neg-ink",
  invalid_output: "text-sent-neg-ink",
  ai_error: "text-muted-foreground",
};

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SqlEval({ gold }: { gold: Record<string, ResultSet> }) {
  const { settings, hasKey } = useAiSettings();
  const [reps, setReps] = useState(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [live, setLive] = useState<EvalItemResult[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const refresh = useCallback(
    () =>
      listRuns()
        .then(setRuns)
        .catch(() => setStorageError(true)),
    [],
  );
  useEffect(() => {
    let alive = true;
    listRuns()
      .then((r) => {
        if (alive) setRuns(r);
      })
      .catch(() => {
        if (alive) setStorageError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const start = async () => {
    if (!hasKey) {
      openAiSettings();
      return;
    }
    const ctl = new AbortController();
    abort.current = ctl;
    const batchId = newId();
    const model = modelFor(settings);
    setRunning(true);
    setProgress({ done: 0, total: BENCHMARK.length * reps });
    for (let rep = 1; rep <= reps && !ctl.signal.aborted; rep++) {
      const results: EvalItemResult[] = [];
      setLive([]);
      for (const item of BENCHMARK) {
        if (ctl.signal.aborted) break;
        const key = getKey(settings.provider);
        let reply: { answerable: boolean; sql: string } | null = null;
        let aiError: string | undefined;
        let latency: number | null = null;
        let usage: TokenUsage | null = null;
        let served: string | undefined;
        try {
          const res = await generateSql(item.question, settings, key, { signal: ctl.signal });
          reply = res.data;
          latency = res.latencyMs;
          usage = res.usage;
          served = res.servedModel;
        } catch (e) {
          aiError = e instanceof AiError ? e.kind : e instanceof Error ? e.message : String(e);
          // a failed call can still be billed and timed: keep both
          if (e instanceof AiError) {
            latency = e.latencyMs ?? null;
            usage = e.usage;
          }
        }
        const run = reply?.answerable && reply.sql.trim() ? await runSql(reply.sql, ctl.signal) : null;
        const score = scoreItem(item, reply, run, gold[item.id] ?? null, aiError);
        const r: EvalItemResult = {
          id: item.id,
          question: item.question,
          ...score,
          sql: reply?.sql ?? "",
          verdict: run ? verdictSummary(run) : "",
          latencyMs: latency,
          usage,
        };
        results.push(r);
        setLive([...results]);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
        try {
          await appendEntry(
            {
              id: newId(),
              timestamp: new Date().toISOString(),
              feature: "text-to-sql-eval",
              provider: settings.provider,
              model,
              servedModel: served,
              input: { question: item.question, benchmarkId: item.id, runId: batchId },
              output: {
                answerable: reply?.answerable,
                generatedSql: reply?.sql || undefined,
                score: r.status,
              },
              validation: run
                ? { verdict: run.verdict, issues: run.issues.map((i) => i.message) }
                : undefined,
              rowCount: run?.rowCount,
              latencyMs: { model: latency ?? 0, sql: run?.elapsedMs, total: latency ?? 0 },
              usage,
              decision: "not-applicable",
              error: aiError,
            },
            [key],
          );
        } catch {
          /* the log is best effort when IndexedDB is unavailable */
        }
        if (aiError === "invalid_key" || aiError === "quota" || aiError === "no_key") {
          ctl.abort(); // no point spending the rest of the run
        }
      }
      if (results.length === BENCHMARK.length) {
        try {
          await saveRun({
            id: newId(),
            timestamp: new Date().toISOString(),
            provider: settings.provider,
            model,
            repetition: rep,
            batchId,
            results,
          });
        } catch {
          setStorageError(true);
        }
      }
    }
    setRunning(false);
    await refresh();
  };

  const liveSummary = useMemo(() => (live.length ? summariseRun(live, ANSWERABLE) : null), [live]);
  const pair = useMemo(() => {
    if (pick.length !== 2) return null;
    const a = runs.find((r) => r.id === pick[0]);
    const b = runs.find((r) => r.id === pick[1]);
    return a && b ? { a, b, cmp: compareRuns(a, b, ANSWERABLE) } : null;
  }, [pick, runs]);

  const calls = BENCHMARK.length * reps;

  return (
    <div className="space-y-8">
      {/* ---- run controls ---------------------------------------------------------- */}
      <div className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2 text-sm">
          <p>
            {hasKey ? (
              <>
                Runs on <strong>{PROVIDER_LABEL[settings.provider]}</strong> ·{" "}
                <code>{modelFor(settings)}</code> with your key.{" "}
                <button type="button" className="link" onClick={openAiSettings}>
                  Change
                </button>
              </>
            ) : (
              "Add your own key to run the benchmark. Nothing is pre-scored or published here."
            )}
          </p>
          <label className="flex items-center gap-2 text-xs">
            Repetitions
            <select
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
              disabled={running}
              className="border-input bg-background rounded-md border px-2 py-1"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">
              {calls} model calls (about {Math.round(calls * 3.5)}k input tokens) billed to your key
            </span>
          </label>
        </div>
        <div className="flex gap-2">
          {running && (
            <Button variant="outline" onClick={() => abort.current?.abort()}>
              Stop
            </Button>
          )}
          {hasKey ? (
            <Button onClick={() => void start()} disabled={running}>
              {running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {running ? `Running ${progress.done}/${progress.total}` : "Run benchmark"}
            </Button>
          ) : (
            <Button onClick={openAiSettings}>
              <KeyRound aria-hidden /> Add your key
            </Button>
          )}
        </div>
      </div>
      {storageError && (
        <p className="text-sent-neg-ink text-sm" role="alert">
          This browser blocked IndexedDB, so runs are shown but not saved.
        </p>
      )}

      {/* ---- current run ------------------------------------------------------------- */}
      {liveSummary && (
        <section aria-live="polite" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-semibold">{running ? "Running" : "Latest run"}</h3>
            <AiGeneratedLabel model={modelFor(settings)} />
          </div>
          <SummaryStrip results={live} />
          <ItemTable results={live} />
        </section>
      )}

      {/* ---- the benchmark ------------------------------------------------------------- */}
      {!liveSummary && (
        <section className="space-y-3">
          <h3 className="font-serif text-xl font-semibold">The {BENCHMARK.length} questions</h3>
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">Benchmark questions</caption>
              <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    id
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Question
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Tests
                  </th>
                  <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">
                    Gold answer
                  </th>
                </tr>
              </thead>
              <tbody>
                {BENCHMARK.map((b) => (
                  <tr key={b.id} className="border-border/70 border-t align-top">
                    <td className="text-muted-foreground px-3 py-2 font-mono text-xs">{b.id}</td>
                    <td className="px-3 py-2">
                      {b.question}
                      <span className="text-muted-foreground block text-xs">{b.note}</span>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">{b.skill}</td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      {b.goldSql ? (
                        <details>
                          <summary className="cursor-pointer text-xs">
                            {(gold[b.id]?.rows ?? [])
                              .slice(0, 2)
                              .map((r) =>
                                r
                                  .map((v) =>
                                    typeof v === "number" && !Number.isInteger(v)
                                      ? Number(v.toPrecision(4))
                                      : v,
                                  )
                                  .join(", "),
                              )
                              .join("; ")}
                            {(gold[b.id]?.rows.length ?? 0) > 2 ? "; …" : ""}
                          </summary>
                          <code className="mt-1 block text-[11px] whitespace-pre-wrap">{b.goldSql}</code>
                        </details>
                      ) : (
                        <span className="text-muted-foreground text-xs">refuse</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- saved runs ------------------------------------------------------------------ */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-xl font-semibold">Saved runs (this browser)</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!runs.length}
              onClick={() => download("social-sense-text-to-sql-runs.csv", runsToCsv(runs), "text/csv")}
            >
              <Download aria-hidden /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!runs.length}
              onClick={() =>
                download(
                  "social-sense-text-to-sql-runs.json",
                  JSON.stringify({ benchmark: BENCHMARK, runs }, null, 2),
                  "application/json",
                )
              }
            >
              <Download aria-hidden /> JSON
            </Button>
            {confirmDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={running}
                  onClick={async () => {
                    await deleteRuns();
                    setPick([]);
                    setConfirmDelete(false);
                    await refresh();
                  }}
                >
                  Yes, delete {runs.length} run{runs.length === 1 ? "" : "s"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                disabled={!runs.length || running}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden /> Delete all
              </Button>
            )}
          </div>
        </div>
        {runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No runs yet. Completed runs are saved here for comparison.
          </p>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">Saved benchmark runs</caption>
              <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    <span className="sr-only">Compare</span>
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    When
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Model
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Execution accuracy [95% CI]
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Refusals
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Unusable or invalid SQL
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const s = summariseRun(r.results, ANSWERABLE);
                  const checked = pick.includes(r.id);
                  return (
                    <tr key={r.id} className={cn("border-border/70 border-t", checked && "bg-primary/5")}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Compare the run of ${r.model} at ${r.timestamp}`}
                          checked={checked}
                          onChange={(e) =>
                            setPick((p) =>
                              e.target.checked
                                ? [...p.filter((x) => x !== r.id), r.id].slice(-2)
                                : p.filter((x) => x !== r.id),
                            )
                          }
                          className="size-4 accent-[var(--primary)]"
                        />
                      </td>
                      <td className="num text-muted-foreground px-3 py-2 text-xs whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleString("en-AU")}
                        <span className="block">rep {r.repetition}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.model}</td>
                      <td className="num px-3 py-2 text-xs">{fmtProp(s.accuracy)}</td>
                      <td className="num px-3 py-2 text-xs">{fmtProp(s.refusal)}</td>
                      <td className="num px-3 py-2 text-xs">{fmtProp(s.invalidSql)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <SpreadNote runs={runs} />
        {pair && <PairedPanel a={pair.a} b={pair.b} cmp={pair.cmp} />}
        {runs.length >= 2 && !pair && (
          <p className="text-muted-foreground text-xs">Tick two runs to compare them question by question.</p>
        )}
        <p className="text-muted-foreground text-xs">
          Every model call of a run is also in the{" "}
          <Link className="link" href="/ai-log">
            audit log
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function SummaryStrip({ results }: { results: EvalItemResult[] }) {
  const s = summariseRun(results, ANSWERABLE);
  const stats = [
    { label: "Execution accuracy (answerable)", value: fmtProp(s.accuracy) },
    { label: "Correct refusals (unanswerable)", value: fmtProp(s.refusal) },
    { label: "Unusable, blocked or failing SQL", value: fmtProp(s.invalidSql) },
    {
      label: "Median model latency [95% CI]",
      value: s.latency
        ? `${(s.latency.median / 1000).toFixed(1)} s [${(s.latency.lower / 1000).toFixed(1)}, ${(s.latency.upper / 1000).toFixed(1)}]`
        : "–",
    },
    {
      label: "Tokens per question",
      value: s.tokens ? `${Math.round(s.tokens.perQuestion).toLocaleString("en-AU")}` : "–",
    },
  ];
  return (
    <>
      <dl className="border-border bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((x) => (
          <div key={x.label} className="bg-card px-4 py-3">
            <dt className="text-muted-foreground text-xs">{x.label}</dt>
            <dd className="num mt-1 text-sm font-semibold">{x.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-xs">
        Wilson 95% intervals; with {ANSWERABLE.size} answerable questions an interval is up to about ±25
        points wide, so treat a single run as a rough reading, not a ranking. Unusable model replies
        (malformed or cut off: {s.modelFailures}) count as wrong, and their tokens and time are included. Only
        infrastructure failures (key, quota, rate limit, network or provider outage: {s.aiErrors}) are left
        out of the denominators. Latency interval: percentile bootstrap of the median (2,000 resamples, seed
        57).
      </p>
    </>
  );
}

function ItemTable({ results }: { results: EvalItemResult[] }) {
  return (
    <ScrollRegion
      label="Per-question results (scrolls sideways)"
      className="border-border bg-card rounded-lg border"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Per-question results</caption>
        <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              id
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Result
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Model SQL
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              ms
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              tokens
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-border/70 border-t align-top">
              <td className="text-muted-foreground px-3 py-2 font-mono text-xs">{r.id}</td>
              <td className="px-3 py-2">
                <span className={cn("text-xs font-semibold", STATUS_TONE[r.status])}>
                  {STATUS_LABEL[r.status]}
                </span>
                <span className="text-muted-foreground block text-xs">{r.detail}</span>
              </td>
              <td className="max-w-[28rem] px-3 py-2">
                {r.sql ? (
                  <code className="text-[11px] break-words whitespace-pre-wrap">{r.sql}</code>
                ) : (
                  <span className="text-muted-foreground text-xs">none</span>
                )}
              </td>
              <td className="num text-muted-foreground px-3 py-2 text-right text-xs">{r.latencyMs ?? "–"}</td>
              <td className="num text-muted-foreground px-3 py-2 text-right text-xs">
                {r.usage ? r.usage.inputTokens + r.usage.outputTokens : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

/** Spread of accuracy across repeated runs of the same model (run-to-run variation). */
function SpreadNote({ runs }: { runs: EvalRun[] }) {
  const batches = new Map<string, EvalRun[]>();
  for (const r of runs) batches.set(r.batchId, [...(batches.get(r.batchId) ?? []), r]);
  const multi = [...batches.values()].filter((b) => b.length > 1);
  if (!multi.length) return null;
  return (
    <ul className="text-muted-foreground space-y-1 text-xs">
      {multi.map((b) => {
        const acc = b.map((r) => summariseRun(r.results, ANSWERABLE).accuracy.estimate);
        return (
          <li key={b[0].batchId}>
            <code>{b[0].model}</code>, {b.length} repetitions: accuracy {acc.map(pct).join(", ")} (range{" "}
            {pct(Math.min(...acc))}–{pct(Math.max(...acc))}). Differences between repetitions are sampling
            variation of the model, not of the questions.
          </li>
        );
      })}
    </ul>
  );
}

function PairedPanel({ a, b, cmp }: { a: EvalRun; b: EvalRun; cmp: ReturnType<typeof compareRuns> }) {
  return (
    <div className="border-border bg-card space-y-3 rounded-lg border p-4">
      <p className="font-medium">
        Paired comparison: <code>{a.model}</code> (A) vs <code>{b.model}</code> (B), same {cmp.pairs}{" "}
        answerable questions
      </p>
      <div className="grid max-w-md grid-cols-[auto_1fr_1fr] gap-px overflow-hidden rounded-md border text-center text-xs">
        <span className="bg-muted/60 p-2" />
        <span className="bg-muted/60 p-2 font-medium">B correct</span>
        <span className="bg-muted/60 p-2 font-medium">B wrong</span>
        <span className="bg-muted/60 p-2 font-medium">A correct</span>
        <span className="bg-card num p-2">{cmp.bothCorrect}</span>
        <span className="bg-card num p-2 font-semibold">{cmp.onlyA}</span>
        <span className="bg-muted/60 p-2 font-medium">A wrong</span>
        <span className="bg-card num p-2 font-semibold">{cmp.onlyB}</span>
        <span className="bg-card num p-2">{cmp.neither}</span>
      </div>
      <p className="text-sm">
        Accuracy difference A − B:{" "}
        <strong className="num">
          {pts(cmp.difference)} points [95% CI {pts(cmp.differenceCi.lower)}, {pts(cmp.differenceCi.upper)}]
        </strong>
        . Exact McNemar test on the {cmp.onlyA + cmp.onlyB} discordant questions:{" "}
        <strong className="num">p = {cmp.mcnemar.p.toFixed(3)}</strong>.
      </p>
      <p className="text-muted-foreground text-xs">
        Interval: Tango&apos;s score interval for a paired difference (checked against R&apos;s PropCIs). Only
        questions where exactly one run was right carry information about which is better. With {cmp.pairs}{" "}
        questions a real difference needs to be large to show up; an interval that spans zero is not evidence
        that the two are equal.
      </p>
    </div>
  );
}
