"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import { Segmented } from "@/components/scenario/segmented";
import { Button } from "@/components/ui/button";
import {
  type AuditEntry,
  type AuditFeature,
  clearEntries,
  entriesToCsv,
  entriesToJson,
  listEntries,
  onAuditChange,
} from "@/lib/ai/audit-log";
import { wilson } from "@/lib/stats";
import { cn } from "@/lib/utils";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const DECISION_TONE: Record<AuditEntry["decision"], string> = {
  accepted: "text-sent-pos",
  edited: "text-sent-pos",
  rejected: "text-sent-neg",
  pending: "text-muted-foreground",
  "not-applicable": "text-muted-foreground",
};

export function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AuditFeature>("all");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      listEntries()
        .then((e) => {
          if (alive) setEntries(e);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setError(e instanceof Error ? e.message : String(e));
          setEntries([]);
        });
    void load();
    const off = onAuditChange(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);

  const shown = useMemo(
    () => (entries ?? []).filter((e) => filter === "all" || e.feature === filter),
    [entries, filter],
  );
  const asks = (entries ?? []).filter((e) => e.feature === "ask-the-data");
  const decided = asks.filter((e) => e.decision !== "pending");
  const kept = decided.filter((e) => e.decision === "accepted" || e.decision === "edited").length;
  const acceptance = wilson(kept, decided.length);
  const tokens = (entries ?? []).reduce(
    (a, e) => a + (e.usage ? e.usage.inputTokens + e.usage.outputTokens : 0),
    0,
  );

  if (entries === null) return <p className="text-muted-foreground text-sm">Reading the log…</p>;

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sent-neg text-sm" role="alert">
          The log could not be read in this browser ({error}). Private browsing modes sometimes block
          IndexedDB.
        </p>
      )}
      <dl className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4">
        {[
          ["Records", entries.length.toLocaleString("en-AU")],
          ["Questions asked", asks.length.toLocaleString("en-AU")],
          [
            "Kept by a person (accepted or edited)",
            decided.length
              ? `${kept}/${decided.length} [${(acceptance.lower * 100).toFixed(0)}–${(acceptance.upper * 100).toFixed(0)}%]`
              : "–",
          ],
          ["Tokens reported by providers", tokens.toLocaleString("en-AU")],
        ].map(([k, v]) => (
          <div key={k} className="bg-card px-4 py-3">
            <dt className="text-muted-foreground text-xs">{k}</dt>
            <dd className="num mt-1 font-serif text-xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filter by feature"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "ask-the-data", label: "Ask the data" },
            { value: "text-to-sql-eval", label: "Benchmark" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!shown.length}
            onClick={() =>
              download("social-sense-ai-audit-log.json", entriesToJson(shown), "application/json")
            }
          >
            <Download aria-hidden /> JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!shown.length}
            onClick={() => download("social-sense-ai-audit-log.csv", entriesToCsv(shown), "text/csv")}
          >
            <Download aria-hidden /> CSV
          </Button>
          {confirming ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  await clearEntries();
                  setConfirming(false);
                }}
              >
                Yes, delete all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              disabled={!entries.length}
              onClick={() => setConfirming(true)}
            >
              <Trash2 aria-hidden /> Clear log
            </Button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-6 text-sm">
          <p className="font-medium">No AI calls recorded in this browser yet.</p>
          <p className="text-muted-foreground mt-1">
            Records appear here when you use{" "}
            <Link className="link" href="/ask">
              Ask the data
            </Link>{" "}
            or run the{" "}
            <Link className="link" href="/ask/eval">
              benchmark
            </Link>{" "}
            with your own key.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {shown.map((e) => (
            <li key={e.id} className="border-border bg-card rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground num text-xs">
                    {new Date(e.timestamp).toLocaleString("en-AU")} ·{" "}
                    {e.feature === "ask-the-data" ? "Ask the data" : `Benchmark ${e.input.benchmarkId ?? ""}`}{" "}
                    · {e.provider} · <code>{e.servedModel ?? e.model}</code>
                  </p>
                  <p className="mt-1 font-medium break-words">{e.input.question}</p>
                </div>
                <span className={cn("text-xs font-semibold", DECISION_TONE[e.decision])}>
                  {e.decision === "not-applicable" ? "scored automatically" : `human decision: ${e.decision}`}
                </span>
              </div>
              <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="inline">Validator: </dt>
                  <dd className="text-foreground inline">
                    {e.validation?.verdict ?? (e.output.answerable === false ? "not needed (declined)" : "–")}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Rows: </dt>
                  <dd className="text-foreground num inline">{e.rowCount ?? "–"}</dd>
                </div>
                <div>
                  <dt className="inline">Latency: </dt>
                  <dd className="text-foreground num inline">
                    {e.latencyMs.total.toLocaleString("en-AU")} ms
                  </dd>
                </div>
                <div>
                  <dt className="inline">Tokens: </dt>
                  <dd className="text-foreground num inline">
                    {e.usage
                      ? `${e.usage.inputTokens.toLocaleString("en-AU")} in / ${e.usage.outputTokens.toLocaleString("en-AU")} out`
                      : "–"}
                  </dd>
                </div>
              </dl>
              {(e.output.generatedSql ||
                e.output.answer ||
                e.output.reason ||
                e.error ||
                e.validation?.issues.length) && (
                <details className="mt-3">
                  <summary className="text-primary cursor-pointer text-xs font-medium">Details</summary>
                  <div className="mt-2 space-y-2 text-sm">
                    <AiGeneratedLabel />
                    {e.output.reason && <p className="text-xs">{e.output.reason}</p>}
                    {e.output.generatedSql && (
                      <pre className="bg-muted/60 overflow-x-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
                        {e.output.generatedSql}
                      </pre>
                    )}
                    {e.output.editedSql && (
                      <>
                        <p className="text-xs font-medium">Edited by a person and run instead:</p>
                        <pre className="bg-muted/60 overflow-x-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
                          {e.output.editedSql}
                        </pre>
                      </>
                    )}
                    {!!e.validation?.issues.length && (
                      <ul className="text-sent-neg list-disc pl-5 text-xs">
                        {e.validation.issues.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    )}
                    {e.output.answer && (
                      <p>
                        {e.output.answer}
                        {e.output.grounded === false && (
                          <span className="text-sent-neg block text-xs">
                            Answer did not cite returned rows.
                          </span>
                        )}
                      </p>
                    )}
                    {e.output.score && <p className="text-xs">Benchmark result: {e.output.score}</p>}
                    {e.error && <p className="text-sent-neg text-xs">{e.error}</p>}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
