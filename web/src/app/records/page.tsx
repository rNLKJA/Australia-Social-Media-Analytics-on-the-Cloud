import { Database, Download, Table2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Note, PageHeader, Section } from "@/components/editorial/page-header";
import { fmtInt } from "@/lib/format";
import { TABLE_DOCS, listTables } from "@/server/records";

export const metadata: Metadata = {
  title: "Records",
  description:
    "Browse, search and download every table of the read-only analytics database behind Social Sense.",
};

const GROUP_ORDER = ["Scenarios", "Sentiment", "SUDO", "Geography", "Context", "Other"];
const DOC_KEYS = Object.keys(TABLE_DOCS);
const order = (name: string) => (DOC_KEYS.includes(name) ? DOC_KEYS.indexOf(name) : 999);

export default async function RecordsPage() {
  const tables = await listTables();
  const total = tables.reduce((a, t) => a + t.rows, 0);
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    tables: tables
      .filter((t) => (TABLE_DOCS[t.name]?.group ?? "Other") === g)
      .sort((a, b) => order(a.name) - order(b.name)),
  })).filter((g) => g.tables.length);

  return (
    <>
      <PageHeader
        kicker="Open data · analytics.db"
        title="Every number on this site, as tables"
        lede={
          <>
            The app reads a single read-only SQLite file built by <code>scripts/build_analytics.py</code>. It
            holds {tables.length} tables and {fmtInt(total)} rows of aggregates: counts and score sums,
            official statistics and boundary metadata. No tweet or toot text, user names or ids are stored.
          </>
        }
      />
      <Section kicker="Tables" title="Browse the database" className="pt-10">
        <div className="space-y-10">
          {groups.map((g) => (
            <div key={g.group}>
              <h2 className="kicker mb-3">{g.group}</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.tables.map((t) => {
                  const doc = TABLE_DOCS[t.name];
                  return (
                    <li
                      key={t.name}
                      className="group border-border bg-card hover:border-primary/60 relative rounded-lg border p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium">
                            <Link
                              href={`/records/${t.name}`}
                              className="after:absolute after:inset-0 focus-visible:outline-none"
                            >
                              {doc?.title ?? t.name}
                            </Link>
                          </h3>
                          <p className="text-muted-foreground font-mono text-xs">{t.name}</p>
                        </div>
                        <span className="num bg-muted shrink-0 rounded-full px-2 py-0.5 text-xs">
                          {fmtInt(t.rows)} rows
                        </span>
                      </div>
                      {doc && <p className="text-muted-foreground mt-2 text-sm">{doc.description}</p>}
                      <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Table2 className="size-3.5" aria-hidden /> {t.columns.length} columns
                        </span>
                        <a
                          href={`/records/${t.name}/csv`}
                          className="hover:text-foreground relative z-10 inline-flex items-center gap-1"
                          aria-label={`Download ${t.name} as CSV`}
                        >
                          <Download className="size-3.5" aria-hidden /> CSV
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-border bg-muted/40 mt-12 flex items-start gap-3 rounded-lg border p-4">
          <Database className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <Note>
            Provenance and licences: Twitter aggregates derive from the University-provided corpus (Australian
            Data Observatory); SUDO income and offence figures are ABS and Crime Statistics Agency Victoria
            data; ABS boundaries are CC BY 4.0. The whole file is in the repository at{" "}
            <code>web/data/analytics.db</code> and can be opened with any SQLite browser.
          </Note>
        </div>
      </Section>
    </>
  );
}
