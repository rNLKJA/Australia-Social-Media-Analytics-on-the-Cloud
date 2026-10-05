import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/editorial/markdown";
import { PageHeader } from "@/components/editorial/page-header";
import { SITE } from "@/lib/site";
import { getModelCard } from "@/server/content";

export const metadata: Metadata = {
  title: "Model card",
  description:
    "Model card for the 2023 VADER sentiment pipeline and the optional bring-your-own-key text-to-SQL assistant: intended use, provenance, evaluation with intervals, failure modes and ethics.",
};

export default async function ModelCardPage() {
  const card = await getModelCard();
  return (
    <>
      <PageHeader
        kicker="Data & methods · model card"
        title={card.title.replace(/^Model card: /, "")}
        lede={
          <>
            What each model is for, what it was built from, how it was evaluated (with intervals), how it
            fails and what to keep in mind. Source:{" "}
            <a className="link" href={`${SITE.repo}/blob/main/docs/model-card.md`}>
              docs/model-card.md
            </a>
            .
          </>
        }
      />
      <article className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Markdown source={card.body} />
        <p className="text-muted-foreground mt-12 text-sm">
          <Link className="link" href="/methods">
            Back to data and methods
          </Link>
        </p>
      </article>
    </>
  );
}
