import { ArrowRight, Database, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AskData } from "@/components/ask/ask-data";
import { Note, PageHeader, Section } from "@/components/editorial/page-header";
import { ROWS_SENT } from "@/lib/ai/text-to-sql";
import { SCHEMA } from "@/lib/sql/schema";
import { MAX_ROWS } from "@/server/sql/guard";
import { QUERY_TIMEOUT_MS } from "@/server/sql/execute";

export const metadata: Metadata = {
  title: "Ask the data",
  description:
    "Ask a question in plain English: your own AI model writes one SQL query, this site validates it and runs it read-only, and the model explains the rows it cites. Bring your own key; fully auditable.",
};

const STEPS = [
  {
    icon: KeyRound,
    title: "Your model writes SQL",
    body: "Your browser sends the question and the documented schema to your provider with your key. The model returns one query, or declines.",
  },
  {
    icon: ShieldCheck,
    title: "The server checks and runs it",
    body: `Only the SQL reaches this site. A validator allows one SELECT on documented tables; SQLite runs it read-only, at most ${MAX_ROWS} rows, ${QUERY_TIMEOUT_MS / 1000} s.`,
  },
  {
    icon: Sparkles,
    title: "Your model explains the rows",
    body: `Up to ${ROWS_SENT} returned rows go back to your model, which must cite them as [r1], [r2]. Citations are checked against the table.`,
  },
];

export default function AskPage() {
  return (
    <>
      <PageHeader
        kicker="Optional AI · bring your own key"
        title="Ask the data in plain English"
        lede={
          <>
            Ask about the database behind this site. A language model you choose turns the question into SQL,
            the site checks and runs that SQL read-only, and the model explains the result, pointing at the
            rows it used. Every step is shown, labelled and logged in your browser.
          </>
        }
      >
        <ol className="border-border bg-border grid gap-px overflow-hidden rounded-lg border md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-card flex gap-3 p-4">
              <s.icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold">
                  {i + 1}. {s.title}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </PageHeader>

      <Section kicker="Ask" title="Your question" className="pt-10">
        <AskData />
      </Section>

      <Section
        kicker="Governance"
        title="What goes where"
        intro={
          <p>
            The site has no AI budget and no server-side AI: it only lends your model a validated, read-only
            view of public aggregates. The full statement, including what the AI never does, is on the{" "}
            <Link href="/methods#ai-use">methods page</Link>.
          </p>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "Sent to your provider",
              "Your question exactly as you type it (so leave out anything personal), the table and column descriptions below, the generated SQL and up to 30 result rows of public aggregate data.",
            ],
            [
              "Sent to this site",
              "Only the SQL text. The endpoint refuses requests that carry an API key header or any field besides the SQL, and logs nothing.",
            ],
            [
              "Kept in your browser",
              "Your key (this tab by default) and the audit log: one record per question (both model calls), with the model, SQL, validator verdict, row count, latency, token usage and your decision.",
            ],
          ].map(([h, b]) => (
            <div key={h} className="border-border bg-card rounded-lg border p-4">
              <p className="font-medium">{h}</p>
              <p className="text-muted-foreground mt-1 text-sm">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link className="link inline-flex items-center gap-1" href="/ask/eval">
            How accurate is it? Run the benchmark <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link className="link inline-flex items-center gap-1" href="/ai-log">
            Open the audit log <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Section>

      <Section
        kicker="Schema"
        title="What the model is told about the database"
        intro={
          <p>
            These descriptions are the model&apos;s only knowledge of the data, and the validator&apos;s
            allow-list: a query may use these {SCHEMA.length} tables and their columns, nothing else.
          </p>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {SCHEMA.map((t) => (
            <details key={t.name} className="border-border bg-card rounded-lg border p-3">
              <summary className="cursor-pointer">
                <span className="font-mono text-sm">{t.name}</span>{" "}
                <span className="text-muted-foreground text-xs">· {t.title}</span>
              </summary>
              <p className="text-muted-foreground mt-2 text-xs">{t.description}</p>
              <ul className="mt-2 space-y-0.5 text-xs">
                {t.columns.map((c) => (
                  <li key={c.name}>
                    <code>{c.name}</code>{" "}
                    <span className="text-muted-foreground">
                      {c.type.toLowerCase()} · {c.description}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <Note className="mt-4">
          <Database className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
          Browse the same tables, with search and CSV export, on the{" "}
          <Link className="link" href="/records">
            records pages
          </Link>
          .
        </Note>
      </Section>
    </>
  );
}
