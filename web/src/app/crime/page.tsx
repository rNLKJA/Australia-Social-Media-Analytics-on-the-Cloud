import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { SentimentHistogram } from "@/components/charts/sentiment-histogram";
import { Finding, Note, PageHeader, Section, StatStrip } from "@/components/editorial/page-header";
import { CrimeExplorer } from "@/components/scenario/crime-explorer";
import { SalCrimeCheck } from "@/components/scenario/sal-crime-check";
import { fmtInt, fmtP, fmtPct, fmtR } from "@/lib/format";
import { getCorrelations, getCrimeRegions, getHistogram, getSalRegions } from "@/server/analytics";

export const metadata: Metadata = {
  title: "Scenario 2: crime and sentiment",
  description:
    "Recorded offences in 79 Victorian local government areas compared with the volume and sentiment of crime-related tweets.",
};

export default async function CrimePage() {
  const [regions, correlations, sals, crimeHist, allHist] = await Promise.all([
    getCrimeRegions(),
    getCorrelations(),
    getSalRegions(),
    getHistogram("twitter", "crime"),
    getHistogram("twitter", "all"),
  ]);
  const kept = regions.filter((r) => r.kept);
  const topKept = kept.reduce((a, b) => (b.total > a.total ? b : a));
  const stored = correlations.filter((c) => c.scenario === "crime");
  const salFit = stored.find((c) => c.unit === "sal" && c.minTweets === 1)!;
  const lgaFit = stored.find((c) => c.unit === "lga" && c.yMetric === "avg_crime" && c.minTweets === 1)!;
  const lgaFit5 = stored.find((c) => c.unit === "lga" && c.yMetric === "avg_crime" && c.minTweets === 5)!;
  const salPoints = sals
    .filter((s) => s.crime)
    .map((s) => ({ code: s.code, name: s.name, n: s.crime!.n, avg: s.crime!.sum / s.crime!.n }));
  const vicCrimeTweets = salPoints.reduce((a, p) => a + p.n, 0);
  const crimeTotal = crimeHist.counts.reduce((a, b) => a + b, 0);
  const meanScore = (h: number[]) => h.reduce((a, c, i) => a + c * (i + 1), 0) / h.reduce((a, b) => a + b, 0);
  const melbourne = salPoints.find((p) => p.name === "Melbourne");
  const ballarat = salPoints.find((p) => p.name === "Ballarat Central");

  return (
    <>
      <PageHeader
        kicker="Scenario 2 · Crime"
        title="Where crime is recorded, does the conversation turn darker?"
        lede={
          <>
            The second question paired Victoria Police offence counts with tweets that mention crime, police, theft,
            robbery, arrests, murder or violence. Crime talk is rare and overwhelmingly negative, but is it more negative where
            more offences are recorded?
          </>
        }
      >
        <StatStrip
          stats={[
            { value: String(kept.length), label: "LGAs analysed", note: `${regions.length - kept.length} removed as outliers` },
            { value: fmtInt(topKept.total), label: `Most offences (${topKept.name.replace(" (C)", "")})`, note: "among the 72, reference year 2019" },
            { value: fmtInt(vicCrimeTweets), label: "Crime-related tweets in Victoria", note: `of ${fmtInt(crimeTotal)} Australia-wide` },
            { value: meanScore(crimeHist.counts).toFixed(2), label: "Mean score of crime tweets", note: `vs ${meanScore(allHist.counts).toFixed(2)} for all tweets (1-9)` },
          ]}
        />
      </PageHeader>

      <Section
        kicker="Explore"
        title="Offences on the map, sentiment on the chart"
        intro={
          <p>
            The offence axis is logarithmic because counts span two orders of magnitude, from a few hundred in alpine
            shires to tens of thousands in the inner city. Tick the box to bring back the seven LGAs the team&apos;s
            outlier rule removed, including the City of Melbourne with its {fmtInt(melbourne?.n ?? 4026)} crime tweets.
          </p>
        }
      >
        <CrimeExplorer regions={regions} stored={stored} />
      </Section>

      <Section kicker="Context" title="What the 2023 analysis concluded">
        <div className="grid gap-8 lg:grid-cols-2">
          <Finding source="Team 57 report, sections 6.3.1-6.3.3 (paraphrased)">
            <p>
              Brimbank recorded the most offences of the 72 LGAs. Growth-corridor councils such as Wyndham, Melton and
              Whittlesea were high, likely because of population; Mildura, Ballarat, Greater Bendigo, Greater
              Shepparton, Latrobe, Frankston and Mornington Peninsula also stood out.
            </p>
            <p>
              Crime tweets were concentrated: about 79% of suburbs had ten or fewer. Melbourne led with{" "}
              {fmtInt(melbourne?.n ?? 4026)}, then Ballarat with {fmtInt(ballarat?.n ?? 485)}, consistent with the
              offence data. The team also observed that suburbs with more crime discussion tended to sound more
              negative.
            </p>
          </Finding>
          <div className="space-y-4">
            <h3 className="font-serif text-xl font-semibold">Revisited with the same data</h3>
            <div className="prose-civic text-muted-foreground">
              <p>
                Two things hold up. Crime tweets are strongly negative: the most common score is 1 (
                {fmtPct(crimeHist.counts[0] / crimeTotal)} of them), against a neutral mode for tweets in general. And
                the volume ranking matches.
              </p>
              <p>
                The link between offences and tone is fragile. Across LGAs with any crime tweet, Pearson r is{" "}
                {fmtR(lgaFit.pearsonR)} ({fmtP(lgaFit.pearsonP)}, {lgaFit.n} LGAs), but it vanishes (r ={" "}
                {fmtR(lgaFit5.pearsonR)}) once each LGA needs five tweets. At suburb level, more crime talk does not
                predict a more negative tone (r = {fmtR(salFit.pearsonR)}, {fmtP(salFit.pearsonP)}).
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        kicker="Tone"
        title="Crime talk skews hard to the negative"
        intro={
          <p>
            Bars show the share of crime-related tweets at each score; dashed outlines show all geotagged tweets for
            comparison.
          </p>
        }
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Twitter, Feb-Jul 2022</h3>
            <p className="num text-xs text-muted-foreground">
              {fmtInt(crimeTotal)} crime tweets · {fmtInt(allHist.counts.reduce((a, b) => a + b, 0))} geotagged tweets
            </p>
            <SentimentHistogram
              counts={crimeHist.counts}
              compare={allHist.counts}
              compareLabel="All geotagged tweets"
              label="Sentiment distribution of crime-related tweets compared with all tweets"
              className="mt-3"
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="px-1 text-sm font-semibold">Does more crime talk mean a darker tone? (suburbs)</h3>
            <p className="num px-1 text-xs text-muted-foreground">
              {salFit.n} Victorian suburbs · slope {salFit.slope.toFixed(2)} points per tenfold increase · r ={" "}
              {fmtR(salFit.pearsonR)}
            </p>
            <SalCrimeCheck points={salPoints} fit={{ slope: salFit.slope, intercept: salFit.intercept }} />
          </div>
        </div>
      </Section>

      <Section kicker="Offences" title="The busiest LGAs, including the ones the filter removed">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
          <BarList
            ariaLabel="Recorded offences by LGA, top 15"
            items={[...regions]
              .sort((a, b) => b.total - a.total)
              .slice(0, 15)
              .map((r) => ({
                key: r.code,
                label: r.name,
                value: r.total,
                display: fmtInt(r.total),
                color: r.kept ? "var(--seq-4)" : "var(--rule)",
                highlight: r.kept,
                note: r.kept ? undefined : "removed as outlier",
              }))}
          />
          <div className="prose-civic text-sm text-muted-foreground">
            <p>
              Grey bars are LGAs the team&apos;s IQR rule removed (any of the six offence divisions outside 1.5 times
              the interquartile range). That rule drops the very places with the most crime and the most crime
              tweets, which is why the explorer lets you add them back.
            </p>
            <Note className="mt-4">
              Offence divisions follow the Crime Statistics Agency classification: against the person, property and
              deception, drug, public order and security, justice procedures, and other offences. Missing divisions
              were filled with zero, as in the original Flask code.
            </Note>
            <p className="mt-4">
              See <Link href="/methods">data and methods</Link> for how suburbs were assigned to LGAs.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
