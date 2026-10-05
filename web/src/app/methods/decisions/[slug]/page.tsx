import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/editorial/markdown";
import { PageHeader } from "@/components/editorial/page-header";
import { SITE } from "@/lib/site";
import { getDecision, listDecisions } from "@/server/content";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listDecisions()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata(props: PageProps<"/methods/decisions/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const d = await getDecision(slug);
  return d ? { title: `${d.id}: ${d.title}`, description: `Decision record ${d.id} for Social Sense.` } : {};
}

export default async function DecisionPage(props: PageProps<"/methods/decisions/[slug]">) {
  const { slug } = await props.params;
  const all = await listDecisions();
  const i = all.findIndex((d) => d.slug === slug);
  if (i < 0) notFound();
  const d = all[i];
  const prev = all[i - 1];
  const next = all[i + 1];
  // the header shows status and date; drop the metadata bullets from the body
  const body = d.body.replace(/^(- \*\*[^*]+:\*\* .+\n?)+/m, "").trim();
  return (
    <>
      <PageHeader kicker={`Decision record · ${d.id}`} title={d.title}>
        <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <dt className="inline font-medium">Status: </dt>
            <dd className="inline">{d.status}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Decided: </dt>
            <dd className="inline">{d.decided}</dd>
          </div>
          <div className="w-full">
            <dt className="inline font-medium">Scope: </dt>
            <dd className="inline">
              <Markdown source={d.scope} className="inline [&_p]:mt-0 [&_p]:inline" />
            </dd>
          </div>
          <div>
            <dt className="sr-only">Source</dt>
            <dd>
              <a className="link" href={`${SITE.repo}/blob/main/docs/decisions/${d.slug}.md`}>
                Source in docs/decisions
              </a>
            </dd>
          </div>
        </dl>
      </PageHeader>
      <article className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Markdown source={body} />
        <nav
          aria-label="Decision records"
          className="border-border mt-14 flex flex-wrap justify-between gap-4 border-t pt-6 text-sm"
        >
          {prev ? (
            <Link href={`/methods/decisions/${prev.slug}`} className="link inline-flex items-center gap-1">
              <ArrowLeft className="size-4" aria-hidden /> {prev.id}: {prev.title}
            </Link>
          ) : (
            <Link href="/methods#decisions" className="link inline-flex items-center gap-1">
              <ArrowLeft className="size-4" aria-hidden /> All decision records
            </Link>
          )}
          {next && (
            <Link
              href={`/methods/decisions/${next.slug}`}
              className="link inline-flex items-center gap-1 text-right"
            >
              {next.id}: {next.title} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </nav>
      </article>
    </>
  );
}
