import type { Metadata } from "next";
import { Finding, PageHeader, Section } from "@/components/editorial/page-header";
import { PipelineLab, type SalInfo } from "@/components/pipeline/pipeline-lab";
import { getSalRegions } from "@/server/analytics";

export const metadata: Metadata = {
  title: "Try the 2023 pipeline",
  description:
    "Score any text exactly as Team 57's tweet processor did in 2023: NLTK tokenisation, WordNet lemmatisation, VADER and the 1-9 sentiment scale, ported to TypeScript and running in your browser.",
};

export default async function PipelinePage() {
  const sals = await getSalRegions();
  const salInfo: Record<string, SalInfo> = {};
  for (const s of sals) if (s.all) salInfo[s.code] = { name: s.name, n: s.all.n, avg: s.all.avg };

  return (
    <>
      <PageHeader
        kicker="Interactive · the scoring pipeline"
        title="Score a post the way the 2023 cluster did"
        lede={
          <>
            Tweets went through seven steps on the Melbourne Research Cloud: clean, tokenise, lemmatise,
            score, bucket, geocode and count. Toots took a shorter path through the Mastodon harvester, with
            no cleaning and no place. Both paths have been ported line for line to TypeScript, including
            NLTK&apos;s tokenisers, the WordNet lemmatiser and VADER, and checked against the original output.
            Pick a path, type below and watch each step.
          </>
        }
      />
      <Section kicker="Lab" title="From raw text to a 1-9 score" className="pt-10">
        <PipelineLab sals={salInfo} />
      </Section>
      <Section kicker="Fidelity" title="How faithful is the port?">
        <div className="grid gap-8 lg:grid-cols-2">
          <Finding title="Checked against the original Python">
            <p>
              The unchanged 2023 functions (<code>normalize_string</code>, <code>sentiment_analysis</code>,
              the SAL geocoder and the harvester&apos;s <code>extract_mastodon_info</code>) were run under
              NLTK 3.8.1, BeautifulSoup 4.11 and Python 3.11, the versions in the team&apos;s Docker images.
              The TypeScript port reproduces their output exactly on a 127-post synthetic tweet corpus and 23
              synthetic toots in CI, and locally on 44,156 real toots: identical text after HTML parsing,
              tokens, normalised text, all four VADER scores and buckets.
            </p>
          </Finding>
          <div className="prose-civic text-muted-foreground">
            <p>
              The port keeps the original&apos;s quirks on purpose. Tokens are lemmatised as nouns, so
              &quot;was&quot; becomes &quot;wa&quot;. VADER looks up a repeated word&apos;s first position.
              The place matcher tries every combination of words, shortest first, and keeps the first known
              place, so a one-word hit wins over the full name: &quot;Albert Park, Victoria&quot; lands in
              Albert (NSW), &quot;St Kilda, Victoria&quot; in St Kilda (SA) and &quot;Port Melbourne&quot; in
              Melbourne. An extra lookup in the original that could never succeed (it passed the function
              object instead of the string) is simply absent. Language detection (<code>langdetect</code>) is
              not ported because it never affected the score.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
