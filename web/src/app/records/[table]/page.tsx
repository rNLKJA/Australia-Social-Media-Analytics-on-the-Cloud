import { ArrowDown, ArrowLeft, ArrowUp, Download, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/editorial/page-header";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, TABLE_DOCS, getTable, queryTable, tableParamsSchema } from "@/server/records";

export async function generateMetadata(props: PageProps<"/records/[table]">): Promise<Metadata> {
  const { table } = await props.params;
  const doc = TABLE_DOCS[table];
  return { title: doc ? `${doc.title} (records)` : `Records: ${table}` };
}

function fmtCell(v: string | number | null): string {
  if (v === null) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return Math.abs(v) >= 10000 ? v.toLocaleString("en-AU") : String(v);
    return Number(v.toPrecision(8)).toString();
  }
  return v;
}

export default async function TablePage(props: PageProps<"/records/[table]">) {
  const { table } = await props.params;
  const t = await getTable(table);
  if (!t) notFound();
  const raw = await props.searchParams;
  const parsed = tableParamsSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
    sort: typeof raw.sort === "string" ? raw.sort : undefined,
    dir: typeof raw.dir === "string" ? raw.dir : undefined,
  });
  const params = parsed.success ? parsed.data : tableParamsSchema.parse({});
  const { rows, total, page, pages } = await queryTable(t, params);
  const doc = TABLE_DOCS[t.name];

  const href = (over: Partial<{ q: string; page: number; sort: string; dir: string }>) => {
    const sp = new URLSearchParams();
    const merged = { q: params.q, page: params.page, sort: params.sort, dir: params.dir, ...over };
    if (merged.q) sp.set("q", merged.q);
    if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
    if (merged.sort) sp.set("sort", merged.sort);
    if (merged.sort && merged.dir === "desc") sp.set("dir", "desc");
    const s = sp.toString();
    return `/records/${t.name}${s ? `?${s}` : ""}`;
  };
  const csvHref = `/records/${t.name}/csv${params.q ? `?q=${encodeURIComponent(params.q)}` : ""}`;
  const isCode = (c: string) => /(code|_id|hour|period)$/.test(c) || c.endsWith("_code16") || c.endsWith("_code19");

  return (
    <>
      <PageHeader
        kicker={doc?.group ?? "Records"}
        title={doc?.title ?? t.name}
        lede={doc?.description}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/records" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> All tables
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{t.name}</span>
          <span className="num rounded-full bg-muted px-2 py-0.5 text-xs">{fmtInt(t.rows)} rows</span>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form action={`/records/${t.name}`} method="get" role="search" className="flex w-full max-w-md gap-2">
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
            {params.sort && params.dir === "desc" && <input type="hidden" name="dir" value="desc" />}
            <label htmlFor="q" className="sr-only">
              Search this table
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                id="q"
                name="q"
                defaultValue={params.q}
                placeholder="Search any column"
                className="h-9 w-full rounded-md border border-input bg-card pr-3 pl-8 text-sm focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              />
            </div>
            <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Search
            </button>
          </form>
          <div className="flex items-center gap-3 text-sm">
            <span className="num text-muted-foreground">
              {params.q ? `${fmtInt(total)} matching · ` : ""}page {page} of {pages}
            </span>
            <a
              href={csvHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-medium hover:border-primary/60"
            >
              <Download className="size-4" aria-hidden /> CSV{params.q ? " (filtered)" : ""}
            </a>
          </div>
        </div>

        <div className="relative mt-5 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {doc?.title ?? t.name}, page {page} of {pages}
            </caption>
            <thead className="bg-muted/60">
              <tr>
                {t.columns.map((c) => {
                  const active = params.sort === c.name;
                  const nextDir = active && params.dir === "asc" ? "desc" : "asc";
                  return (
                    <th
                      key={c.name}
                      scope="col"
                      aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : undefined}
                      className="border-b border-border px-3 py-2 text-left font-mono text-xs font-medium whitespace-nowrap"
                    >
                      <Link href={href({ sort: c.name, dir: nextDir, page: 1 })} className="inline-flex items-center gap-1 hover:text-primary">
                        {c.name}
                        {active &&
                          (params.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                      </Link>
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground lowercase">{c.type}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={t.columns.length} className="px-3 py-10 text-center text-muted-foreground">
                    No rows match &quot;{params.q}&quot;.{" "}
                    <Link className="link" href={href({ q: "", page: 1 })}>
                      Clear the search
                    </Link>
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  {t.columns.map((c) => {
                    const v = r[c.name];
                    return (
                      <td
                        key={c.name}
                        className={cn(
                          "max-w-[28rem] px-3 py-1.5 align-top",
                          typeof v === "number" ? "num text-right whitespace-nowrap" : "",
                          typeof v === "string" && v.length > 80 ? "min-w-[24rem]" : "whitespace-nowrap",
                          v === null && "text-muted-foreground/60",
                        )}
                      >
                        {v === null ? "null" : isCode(c.name) ? String(v) : fmtCell(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <span className="num text-muted-foreground">
            Rows {fmtInt(total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1)}-{fmtInt(Math.min(page * PAGE_SIZE, total))} of {fmtInt(total)}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link className="rounded-md border border-border bg-card px-3 py-1.5 hover:border-primary/60" href={href({ page: page - 1 })}>
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground/60" aria-disabled>
                Previous
              </span>
            )}
            {page < pages ? (
              <Link className="rounded-md border border-border bg-card px-3 py-1.5 hover:border-primary/60" href={href({ page: page + 1 })}>
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground/60" aria-disabled>
                Next
              </span>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
