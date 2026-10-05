import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { HourlyTimeline } from "@/components/charts/hourly-timeline";
import { SentimentHistogram } from "@/components/charts/sentiment-histogram";
import { Finding, Note, PageHeader, Section, StatStrip } from "@/components/editorial/page-header";
import { fmtInt, fmtPct } from "@/lib/format";
import { getFacts, getHistogram, getMastodonHourly, getMastodonLanguages } from "@/server/analytics";

export const metadata: Metadata = {
  title: "Mastodon",
  description:
    "Sentiment on mastodon.social, mastodon.au and tictoc.social as harvested by Team 57 in 2023, plus a week of mastodon.social re-scored with the original pipeline.",
};

const SERVERS = [
  { id: "mastodon.social", label: "mastodon.social", blurb: "One of the largest general-purpose instances." },
  { id: "mastodon.au", label: "mastodon.au", blurb: "A server for the Australian community." },
  { id: "tictoc.social", label: "tictoc.social", blurb: "A general-purpose server (\"Mastodon TicToc\" in 2023)." },
] as const;

const LANG_NAMES: Record<string, string> = {
  en: "English",
  und: "Undeclared",
  ja: "Japanese",
  de: "German",
  zh: "Chinese",
  fr: "French",
  es: "Spanish",
  nl: "Dutch",
  it: "Italian",
  pt: "Portuguese",
  cs: "Czech",
  ko: "Korean",
  fi: "Finnish",
  tr: "Turkish",
};

export default async function MastodonPage() {
  const [facts, hours, langs, ...hists] = await Promise.all([
    getFacts(),
    getMastodonHourly(),
    getMastodonLanguages(),
    ...SERVERS.flatMap((s) => [getHistogram(s.id, "all"), getHistogram(s.id, "income")]),
    getHistogram("mastodon.social (re-scored)", "all"),
    getHistogram("mastodon.social (re-scored)", "income"),
    getHistogram("mastodon.social (re-scored)", "crime"),
  ]);
  const byServer = SERVERS.map((s, i) => ({ ...s, all: hists[i * 2], income: hists[i * 2 + 1] }));
  const [reAll, reIncome, reCrime] = hists.slice(6);
  const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
  const social2023 = byServer[0].all.counts;
  const reTotal = sum(reAll.counts);
  const topLangs = langs.slice(0, 12);
  const de = langs.find((l) => l.lang === "de");
  const en = langs.find((l) => l.lang === "en");

  return (
    <>
      <PageHeader
        kicker="Mastodon · 2022-2023"
        title="Three servers, no locations"
        lede={
          <>
            Twitter&apos;s corpus came ready-made; Mastodon had to be harvested. The team&apos;s scheduler asked three
            servers for 40 new toots every ten minutes, cleaned the HTML, and scored each toot with the same pipeline as
            the tweets. Toots carry no location, so Mastodon could only be compared by score distributions, not on a
            map.
          </>
        }
      >
        <StatStrip
          stats={[
            { value: fmtInt(facts.toots_harvested?.value ?? 1659690), label: "Toots harvested by May 2023", note: `${facts.toots_harvested_mb?.value ?? 757.9} MB across three servers` },
            { value: fmtInt(sum(social2023)), label: "mastodon.social toots scored", note: "in the 2023 dashboard" },
            { value: fmtPct(social2023[4] / sum(social2023)), label: "of them scored neutral", note: "versus 48% on Twitter" },
            { value: fmtInt(reTotal), label: "Raw toots re-scored today", note: "one surviving week, 2-9 May 2023" },
          ]}
        />
      </PageHeader>

      <Section
        kicker="As published in 2023"
        title="Each server has its own mood"
        intro={
          <p>
            These are the histograms the original dashboard showed. mastodon.au and tictoc.social look like Twitter; on
            mastodon.social almost everything lands on the neutral 5. For income-related toots the servers turn
            two- or three-humped, which the team read as people either showing off or complaining.
          </p>
        }
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {byServer.map((s) => (
            <article key={s.id} className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-serif text-xl font-semibold">{s.label}</h3>
              <p className="text-xs text-muted-foreground">{s.blurb}</p>
              <div className="mt-4 space-y-5">
                <div>
                  <p className="num text-xs font-medium">All toots · {fmtInt(sum(s.all.counts))}</p>
                  <SentimentHistogram counts={s.all.counts} label={`Sentiment of all toots on ${s.label}`} compact className="mt-1" />
                </div>
                <div>
                  <p className="num text-xs font-medium">Income-related toots · {fmtInt(sum(s.income.counts))}</p>
                  <SentimentHistogram
                    counts={s.income.counts}
                    label={`Sentiment of income-related toots on ${s.label}`}
                    compact
                    className="mt-1"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
        <Finding className="mt-8" source="Team 57 report, sections 6.1, 6.2.3 and 6.3.3 (paraphrased)">
          <p>
            mastodon.social&apos;s scores were packed tightly around 5 with very small variance, unlike the other two
            servers. Income toots split towards the ends (≥ 7 or ≤ 3). Crime was left out of the Mastodon analysis
            because the sampled servers had little crime-related discussion.
          </p>
        </Finding>
      </Section>

      <Section
        kicker="Re-scored"
        title="A week of mastodon.social, run through the original code again"
        intro={
          <>
            <p>
              CouchDB is gone, but 595 thousand raw toots from 2-9 May 2023 survived on the author&apos;s drive.
              Re-scoring them with the unchanged 2023 functions gives a broader spread than the dashboard showed:{" "}
              {fmtPct(reAll.counts[4] / reTotal)} neutral instead of {fmtPct(social2023[4] / sum(social2023))}. The two
              samples are different toots from different weeks, so this is a consistency check, not a correction.
            </p>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold">All toots</h3>
            <p className="num text-xs text-muted-foreground">{fmtInt(reTotal)} re-scored · outline: 2023 dashboard</p>
            <SentimentHistogram
              counts={reAll.counts}
              compare={social2023}
              compareLabel="2023 dashboard (different sample)"
              label="Re-scored mastodon.social toots compared with the 2023 histogram"
              className="mt-3"
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Income-related toots</h3>
            <p className="num text-xs text-muted-foreground">
              {fmtInt(sum(reIncome.counts))} toots ({fmtPct(sum(reIncome.counts) / reTotal, 1)} of all)
            </p>
            <SentimentHistogram counts={reIncome.counts} label="Re-scored income-related toots" className="mt-3" />
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Crime-related toots</h3>
            <p className="num text-xs text-muted-foreground">
              {fmtInt(sum(reCrime.counts))} toots ({fmtPct(sum(reCrime.counts) / reTotal, 1)} of all)
            </p>
            <SentimentHistogram counts={reCrime.counts} label="Re-scored crime-related toots" className="mt-3" />
          </div>
        </div>

        <div className="mt-10 rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Toots per hour, and how they scored</h3>
          <p className="text-xs text-muted-foreground">
            UTC hours. The gap on 6-8 May is a pause in the harvest, not a quiet weekend.
          </p>
          <div className="mt-4">
            <HourlyTimeline hours={hours} />
          </div>
        </div>
      </Section>

      <Section
        kicker="A caveat in the method"
        title="VADER only speaks English"
        intro={
          <p>
            The lexicon behind every score is English. Japanese, Chinese and Korean toots match almost no words and
            fall to neutral, which helps explain mastodon.social&apos;s big central spike. German looks gloomy for a
            different reason: common words such as <em>die</em> (&quot;the&quot;), <em>war</em> (&quot;was&quot;) and{" "}
            <em>hell</em> (&quot;bright&quot;) are strongly negative English entries. German toots average{" "}
            {de ? (de.scoreSum / de.toots).toFixed(2) : "4.19"} against {en ? (en.scoreSum / en.toots).toFixed(2) : "5.39"}{" "}
            for English.
          </p>
        }
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="mb-4 text-sm font-semibold">Share of toots scored neutral, by declared language</h3>
            <BarList
              ariaLabel="Share of toots scored neutral by language"
              max={1}
              items={topLangs.map((l) => ({
                key: l.lang,
                label: `${LANG_NAMES[l.lang] ?? l.lang} (${fmtInt(l.toots)})`,
                value: l.buckets[4] / l.toots,
                display: fmtPct(l.buckets[4] / l.toots),
                color: "var(--sent-5)",
                highlight: l.lang === "en",
              }))}
            />
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold">Mean score by language (5 = neutral)</h3>
            <BarList
              ariaLabel="Mean sentiment score by language"
              max={6}
              items={topLangs.map((l) => {
                const m = l.scoreSum / l.toots;
                return {
                  key: l.lang,
                  label: LANG_NAMES[l.lang] ?? l.lang,
                  value: m,
                  display: m.toFixed(2),
                  color: m < 4.8 ? "var(--sent-3)" : m > 5.2 ? "var(--sent-7)" : "var(--sent-5)",
                  highlight: l.lang === "de",
                };
              })}
            />
            <Note className="mt-4">
              The 2023 harvester stored each toot&apos;s declared language but scored every toot regardless. The same
              applies to tweets. Try German text on the <Link className="link" href="/pipeline">pipeline page</Link>.
            </Note>
          </div>
        </div>
      </Section>
    </>
  );
}
