import type { Metadata } from "next";
import Link from "next/link";
import { SqlEval } from "@/components/ask/sql-eval";
import { PageHeader, Section } from "@/components/editorial/page-header";
import { BENCHMARK } from "@/lib/sql/benchmark";
import type { ResultSet } from "@/lib/sql/compare";
import { runGuardedQuery } from "@/server/sql/execute";

export const metadata: Metadata = {
  title: "Text-to-SQL evaluation",
  description:
    "A small, honest benchmark for the 'Ask the data' feature: 16 questions with hand-written gold SQL, execution accuracy with Wilson intervals, refusal checks and paired comparisons. Runs on your own key.",
};

async function goldResults(): Promise<Record<string, ResultSet>> {
  const out: Record<string, ResultSet> = {};
  for (const b of BENCHMARK) {
    if (!b.goldSql) continue;
    const r = await runGuardedQuery(b.goldSql);
    if (r.verdict !== "allowed")
      throw new Error(`gold SQL for ${b.id} failed: ${r.error?.message ?? r.guard.issues[0]?.message}`);
    out[b.id] = { columns: r.columns, rows: r.rows };
  }
  return out;
}

export default async function EvalPage() {
  const gold = await goldResults();
  const answerable = BENCHMARK.filter((b) => b.goldSql).length;
  return (
    <>
      <PageHeader
        kicker="Ask the data · evaluation"
        title="How often does the model get the SQL right?"
        lede={
          <>
            {BENCHMARK.length} questions about this database, {answerable} with gold SQL written by hand from
            the data and {BENCHMARK.length - answerable} that the data cannot answer. Run them on your model,
            with your key, and get execution accuracy with a confidence interval, the refusal rate, how often
            the validator had to step in, latency and token use.
          </>
        }
      />
      <Section kicker="Run" title="Benchmark your model" className="pt-10">
        <SqlEval gold={gold} />
      </Section>
      <Section kicker="Design" title="How the scoring works">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="prose-civic text-muted-foreground text-sm">
            <p>
              <strong className="text-foreground">Execution match.</strong> The model&apos;s SQL goes through
              the same validator and read-only runner as the live feature. Its result counts as correct when
              it contains the gold result&apos;s columns (in any order, extra columns allowed) and the same
              set of rows: integers must match exactly, other numbers within 0.006, text ignoring case. Row
              order is not scored, so &ldquo;top five&rdquo; is about which five.
            </p>
            <p>
              <strong className="text-foreground">Refusals.</strong> Two questions ask for things the database
              does not hold (individual users; 2024). Producing SQL for them counts as a miss even if the SQL
              runs. Declining an answerable question counts as wrong.
            </p>
          </div>
          <div className="prose-civic text-muted-foreground text-sm">
            <p>
              <strong className="text-foreground">Uncertainty.</strong> Proportions carry Wilson 95%
              intervals; median latency a bootstrap interval. Fourteen scored questions give wide intervals by
              design: this is a smoke test that catches a broken prompt or a weak model, not a leaderboard.
              Repeat a run to see run-to-run variation, and compare two runs with the exact McNemar test on
              the questions where they disagree.
            </p>
            <p>
              <strong className="text-foreground">No published scores.</strong> The site has no AI budget and
              does not report results it ran itself. Your runs stay in this browser (export them as CSV or
              JSON). The questions, gold SQL and pinned gold answers are in{" "}
              <code>web/src/lib/sql/benchmark.ts</code> and its test. More in{" "}
              <Link href="/methods#evaluation">methods</Link>.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
