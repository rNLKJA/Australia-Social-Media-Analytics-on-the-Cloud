import type { Metadata } from "next";
import Link from "next/link";
import { SentimentHistogram } from "@/components/charts/sentiment-histogram";
import { Finding, Note, PageHeader, Section, StatStrip } from "@/components/editorial/page-header";
import { TwitterExplorer } from "@/components/scenario/twitter-explorer";
import { fmtInt, fmtPct, fmtScore, plural } from "@/lib/format";
import { median } from "@/lib/pandas";
import { type AreaMean, areaMean } from "@/lib/stats";
import type { SalRegion } from "@/lib/types";
import { getFacts, getHistogram, getSalRegions, getSalSumsq } from "@/server/analytics";

export const metadata: Metadata = {
  title: "Sentiment map",
  description:
    "Average tweet sentiment for 1,085 Victorian suburbs, February to July 2022, reproduced from the Team 57 CouchDB MapReduce views.",
};

interface Ranked {
  region: SalRegion;
  /** t-based 95% interval for the suburb's mean, from the CouchDB `_stats` sums */
  mean: AreaMean;
}

function ExtremeList({ title, items, tone }: { title: string; items: Ranked[]; tone: "neg" | "pos" }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="divide-border/60 mt-2 divide-y text-sm">
        {items.map(({ region: r, mean: m }) => (
          <li key={r.code} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="truncate">{r.name}</span>
            <span className="num text-muted-foreground shrink-0 text-right text-xs">
              {fmtInt(r.all!.n)} tweets ·{" "}
              <span
                className={
                  tone === "neg" ? "text-sent-neg-ink font-semibold" : "text-sent-pos-ink font-semibold"
                }
              >
                {fmtScore(r.all!.avg)}
              </span>
              {m.lower !== null && (
                <span className="block text-[11px]">
                  95% CI {fmtScore(m.lower)}–{fmtScore(m.upper)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** true when every pair of intervals in the list overlaps, so the order within it is not a finding */
const allOverlap = (xs: Ranked[]) =>
  xs.every((a) => xs.every((b) => (a.mean.lower ?? -Infinity) <= (b.mean.upper ?? Infinity)));

export default async function TwitterPage() {
  const [regions, all, facts, sumsq] = await Promise.all([
    getSalRegions(),
    getHistogram("twitter", "all"),
    getFacts(),
    getSalSumsq(),
  ]);
  const withAll = regions.filter((r) => r.all);
  const vicTweets = withAll.reduce((a, r) => a + r.all!.n, 0);
  const total = all.counts.reduce((a, b) => a + b, 0);
  const low = withAll.filter((r) => r.all!.avg <= 4);
  const high = withAll.filter((r) => r.all!.avg > 7);
  const mid = withAll.filter((r) => r.all!.avg > 4 && r.all!.avg <= 7);
  const extremesMedianN = median([...low, ...high].map((r) => r.all!.n));
  const midMedianN = median(mid.map((r) => r.all!.n));
  const busiest = [...withAll].sort((a, b) => b.all!.n - a.all!.n).slice(0, 10);
  const reliable: Ranked[] = withAll
    .filter((r) => r.all!.n >= 100 && sumsq[r.code]?.all !== undefined)
    .map((r) => ({
      region: r,
      mean: areaMean({ n: r.all!.n, sum: r.all!.sum, sumsq: sumsq[r.code]!.all! }),
    }));
  const happiest = [...reliable].sort((a, b) => b.region.all!.avg - a.region.all!.avg).slice(0, 6);
  const gloomiest = [...reliable].sort((a, b) => a.region.all!.avg - b.region.all!.avg).slice(0, 6);
  // suburbs with at least 100 tweets whose whole interval sits below the neutral 5
  const clearlyNegative = reliable.filter((x) => x.mean.upper !== null && x.mean.upper < 5).length;

  return (
    <>
      <PageHeader
        kicker="Twitter · Victoria · Feb-Jul 2022"
        title="How each suburb sounded on Twitter"
        lede={
          <>
            The team&apos;s MPI processors read the University&apos;s Twitter corpus line by line, scored
            every tweet from 1 (extremely negative) to 9 (extremely positive) and matched its place name to a
            2021 ABS suburb. CouchDB MapReduce views then summed the scores per suburb. This is that map,
            rebuilt from the saved view results.
          </>
        }
      >
        <StatStrip
          stats={[
            {
              value: fmtInt(vicTweets),
              label: "Geotagged tweets in Victoria",
              note: `of ${fmtInt(total)} Australia-wide`,
            },
            { value: fmtInt(withAll.length), label: "Victorian suburbs with tweets", note: "ABS SAL 2021" },
            {
              value: fmtPct(all.counts[4] / total),
              label: "Scored neutral (5)",
              note: "the single most common score",
            },
            {
              value: fmtInt(facts.tweets_processed?.value ?? 37823414),
              label: "Tweets processed in 2023",
              note: `${facts.twitter_processed_gb?.value ?? 15.9} GB of the 57 GB corpus`,
            },
          ]}
        />
      </PageHeader>

      <Section kicker="Explore" title="The suburb map" className="pb-6">
        <TwitterExplorer regions={regions} sumsq={sumsq} />
      </Section>

      <Section
        kicker="Overall"
        title="Mostly neutral, leaning positive"
        intro={
          <p>
            Across the whole corpus the scores pile up at 5 and the positive side is heavier than the
            negative, the same &quot;slightly right-skewed&quot; shape the team described. Scores come from
            NLTK&apos;s VADER compound score in fixed 0.2-wide bands; you can try the exact pipeline on the{" "}
            <Link className="link" href="/pipeline">
              pipeline page
            </Link>
            .
          </p>
        }
      >
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="border-border bg-card rounded-lg border p-5">
            <h3 className="text-sm font-semibold">All geotagged tweets</h3>
            <p className="num text-muted-foreground text-xs">{fmtInt(total)} tweets with a matched suburb</p>
            <SentimentHistogram
              counts={all.counts}
              label="Sentiment score distribution of all geotagged tweets"
              className="mt-3"
            />
          </div>
          <Finding className="self-start" source="Team 57 report, section 6.1 (paraphrased)">
            <p>
              Most suburbs average between 4 and 7. The few with very low (≤ 4) or very high (&gt; 7) averages
              are scattered with no visible clusters, so the team found no geographic pattern at this level.
            </p>
            <p>
              The saved data explains why: the {low.length + high.length} suburbs at the extremes have a
              median of just {plural(extremesMedianN, "tweet")} each, against {fmtInt(midMedianN)} for the
              rest. Extreme averages are mostly small samples.
            </p>
          </Finding>
        </div>
      </Section>

      <Section kicker="Rankings" title="Busiest, happiest and gloomiest suburbs">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">Most tweets</h3>
            <ol className="divide-border/60 mt-2 divide-y text-sm">
              {busiest.map((r, i) => (
                <li key={r.code} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="truncate">
                    <span className="num text-muted-foreground mr-2 text-xs">{i + 1}</span>
                    {r.name}
                  </span>
                  <span className="num text-muted-foreground shrink-0 text-xs">
                    {fmtInt(r.all!.n)} · avg {fmtScore(r.all!.avg)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <ExtremeList title="Most positive (≥ 100 tweets)" items={happiest} tone="pos" />
          <ExtremeList title="Most negative (≥ 100 tweets)" items={gloomiest} tone="neg" />
        </div>
        <Note className="mt-6">
          Intervals are t-based 95% intervals for each suburb&apos;s mean, from the count, sum and sum of
          squares the CouchDB views kept; tweets are treated as independent, so they are optimistic.{" "}
          {allOverlap(happiest) && allOverlap(gloomiest)
            ? "Within each list every interval overlaps every other, so the order inside a list is not a finding. "
            : ""}
          {clearlyNegative === 0
            ? `None of the ${fmtInt(reliable.length)} suburbs with at least 100 tweets has an interval wholly below the neutral 5. `
            : `${plural(clearlyNegative, "suburb")} with at least 100 tweets ${clearlyNegative === 1 ? "has an interval" : "have intervals"} wholly below the neutral 5. `}
          Place names come from Twitter&apos;s self-reported place field, matched to suburbs by the
          team&apos;s n-gram lookup; a tweet tagged &quot;Melbourne, Victoria&quot; lands in the Melbourne CBD
          suburb, which is why it dominates every ranking.
        </Note>
      </Section>
    </>
  );
}
