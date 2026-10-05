import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { SentimentHistogram } from "@/components/charts/sentiment-histogram";
import { Finding, Note, PageHeader, Section, StatStrip } from "@/components/editorial/page-header";
import { IncomeExplorer } from "@/components/scenario/income-explorer";
import { fmtAud, fmtAudK, fmtInt, fmtP, fmtR } from "@/lib/format";
import { median } from "@/lib/pandas";
import {
  getCorrelations,
  getGccIncome,
  getHistogram,
  getIncomeRegions,
  getJobsIndicators,
  getSalRegions,
} from "@/server/analytics";

export const metadata: Metadata = {
  title: "Scenario 1: income and sentiment",
  description:
    "Median personal income across 420 Victorian SA2 regions compared with the sentiment of income-related tweets, recomputed from the 2023 Team 57 pipeline.",
};

export default async function IncomePage() {
  const [regions, correlations, gcc, jobs, sals, twIncome, msSocial, msAu, msTictoc] = await Promise.all([
    getIncomeRegions(),
    getCorrelations(),
    getGccIncome(),
    getJobsIndicators(),
    getSalRegions(),
    getHistogram("twitter", "income"),
    getHistogram("mastodon.social", "income"),
    getHistogram("mastodon.au", "income"),
    getHistogram("tictoc.social", "income"),
  ]);
  const kept = regions.filter((r) => r.kept);
  const lo = kept.reduce((a, b) => (b.medianAud < a.medianAud ? b : a));
  const hi = kept.reduce((a, b) => (b.medianAud > a.medianAud ? b : a));
  const stored = correlations.filter((c) => c.scenario === "income");
  const headline = stored.find((c) => c.yMetric === "avg_income" && c.minTweets === 1)!;
  const melbourne = sals.find((s) => s.name === "Melbourne");
  const incomeTweets = twIncome.counts.reduce((a, b) => a + b, 0);
  const vicIncomeTweets = sals.reduce((a, s) => a + (s.income?.n ?? 0), 0);
  const jobIncome = jobs
    .filter((j) => j.kind === "income_aud" && !j.indicator.startsWith("total"))
    .sort((a, b) => b.median - a.median);

  return (
    <>
      <PageHeader
        kicker="Scenario 1 · Income"
        title="Do people in richer areas tweet more happily about money?"
        lede={
          <>
            The team asked whether conversations about pay, housing, debt and work sound different in high- and
            low-income parts of Victoria. Here the 2022 tweets that mention money are pooled from suburbs into the
            ABS SA2 areas that carry official income figures, so both can be compared on one map.
          </>
        }
      >
        <StatStrip
          stats={[
            { value: String(kept.length), label: "Victorian SA2s analysed", note: `${regions.length - kept.length} removed as outliers` },
            { value: `${fmtAudK(lo.medianAud)}–${fmtAudK(hi.medianAud)}`, label: "Median income range", note: `${lo.name} to ${hi.name}` },
            { value: fmtInt(vicIncomeTweets), label: "Income-related tweets in Victoria", note: `of ${fmtInt(incomeTweets)} Australia-wide, Feb-Jul 2022` },
            { value: fmtR(headline.pearsonR), label: "Income vs sentiment (Pearson r)", note: `${headline.n} SA2s · ${fmtP(headline.pearsonP)}` },
          ]}
        />
      </PageHeader>

      <Section
        kicker="Explore"
        title="Income on the map, sentiment on the chart"
        intro={
          <p>
            Every dot is an SA2 that had at least one tweet in the chosen category; bigger dots carry more tweets.
            Raise the threshold to drop areas whose average rests on a handful of posts. The correlation is recomputed
            in your browser with the same formulas the build script ran in scipy.
          </p>
        }
      >
        <IncomeExplorer regions={regions} stored={stored} />
      </Section>

      <Section kicker="Context" title="What the 2023 analysis concluded">
        <div className="grid gap-6 lg:grid-cols-2">
          <Finding source="Team 57 report, sections 6.2.1-6.2.4 (paraphrased)">
            <p>
              After the IQR outlier rule, median income across {kept.length} Victorian SA2s ranged from{" "}
              {fmtAud(lo.medianAud)} in {lo.name} to {fmtAud(hi.medianAud)} in {hi.name}, with higher incomes clustered
              around Melbourne and along the coast; the Victorian median was {fmtAud(median(kept.map((r) => r.medianAud)))}.
            </p>
            <p>
              Income talk was extremely concentrated: about 73% of suburbs had fewer than 10 income tweets, while
              Melbourne alone had {melbourne?.income ? fmtInt(melbourne.income.n) : "23,281"}. Sentiment showed no
              geographic pattern and no clear link with income.
            </p>
          </Finding>
          <div className="min-w-0 space-y-3">
            <h3 className="font-serif text-xl font-semibold">Revisited with the same data</h3>
            <p className="prose-civic text-muted-foreground">
              Pooling suburbs into SA2s makes the claim testable. Across all thresholds the relationship stays weak:
              Pearson r between {fmtR(Math.min(...stored.map((s) => s.pearsonR)))} and{" "}
              {fmtR(Math.max(...stored.map((s) => s.pearsonR)))}, never explaining more than{" "}
              {(Math.max(...stored.map((s) => s.r2)) * 100).toFixed(0)}% of the variation. The 2023 reading holds.
            </p>
            <div className="relative overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <caption className="sr-only">Stored correlations for scenario 1</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 font-medium">Sentiment of</th>
                  <th className="py-1.5 font-medium">Min tweets</th>
                  <th className="py-1.5 text-right font-medium">SA2s</th>
                  <th className="py-1.5 text-right font-medium">r</th>
                  <th className="py-1.5 text-right font-medium">ρ</th>
                  <th className="py-1.5 text-right font-medium">p (r)</th>
                </tr>
              </thead>
              <tbody className="num">
                {stored.map((s) => (
                  <tr key={`${s.yMetric}${s.minTweets}`} className="border-b border-border/60">
                    <td className="py-1.5">{s.yMetric === "avg_income" ? "income tweets" : "all tweets"}</td>
                    <td className="py-1.5">≥ {s.minTweets}</td>
                    <td className="py-1.5 text-right">{s.n}</td>
                    <td className="py-1.5 text-right">{fmtR(s.pearsonR)}</td>
                    <td className="py-1.5 text-right">{fmtR(s.spearmanRho)}</td>
                    <td className="py-1.5 text-right">{fmtP(s.pearsonP)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </Section>

      <Section
        kicker="Beyond Victoria"
        title="Income by capital city area"
        intro={
          <p>
            The SUDO summary grouped all 2,234 SA2s with complete records by Greater Capital City Statistical Area. Its
            headline figures reproduce exactly: the ACT has the highest median ($60.2k), regional Victoria the lowest
            median ($41.4k) and lowest mean ($49.6k), and regional Western Australia the highest mean ($71.5k).
          </p>
        }
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="mb-4 text-sm font-semibold">Median of SA2 median incomes</h3>
            <BarList
              ariaLabel="Median personal income by Greater Capital City Statistical Area"
              items={[...gcc]
                .sort((a, b) => b.medianAud - a.medianAud)
                .map((g) => ({
                  key: g.code,
                  label: g.name,
                  value: g.medianAud,
                  display: fmtAudK(g.medianAud),
                  color: g.code.startsWith("2") ? "var(--seq-5)" : "var(--seq-3)",
                  highlight: g.code.startsWith("2"),
                }))}
            />
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold">Median employee income per job, by industry</h3>
            <BarList
              ariaLabel="Median employee income per job by industry, averaged across SA2s"
              items={jobIncome.slice(0, 12).map((j) => ({
                key: j.indicator,
                label: j.label.replace(" - median income per job", ""),
                value: j.median,
                display: fmtAudK(j.median),
                color: "var(--seq-4)",
              }))}
            />
            <Note className="mt-3">
              ABS Jobs in Australia 2018-19, the second SUDO dataset on the original dashboard (median across SA2s of
              each industry&apos;s median income per job).
            </Note>
          </div>
        </div>
      </Section>

      <Section
        kicker="Other platforms"
        title="Money talk on Twitter and Mastodon"
        intro={
          <p>
            Twitter&apos;s income tweets cluster around neutral. The Mastodon servers looked different in 2023: on
            mastodon.social most income posts were either clearly positive or clearly negative, which the team read as
            people showing off or complaining. See the <Link href="/mastodon">Mastodon page</Link> for the full picture.
          </p>
        }
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Twitter, income tweets", twIncome],
            ["mastodon.social", msSocial],
            ["mastodon.au", msAu],
            ["tictoc.social", msTictoc],
          ].map(([label, h]) => (
            <div key={label as string} className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">{label as string}</h3>
              <p className="num text-xs text-muted-foreground">
                {fmtInt((h as typeof twIncome).counts.reduce((a, b) => a + b, 0))} posts
              </p>
              <SentimentHistogram
                counts={(h as typeof twIncome).counts}
                label={`Sentiment distribution of income posts: ${label as string}`}
                compact
                className="mt-2"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="Method" title="How this page was built">
        <div className="prose-civic text-muted-foreground">
          <p>
            Tweets were geocoded by the team to 2021 ABS suburbs (SAL) and flagged as income-related by a CouchDB
            MapReduce view that matched words such as salary, mortgage, afford, job or unfair. Income figures are SUDO
            personal income for 2015-16 on 2016 SA2 boundaries. To join the two, each suburb was assigned to the SA2
            containing its representative point, and tweet counts and score sums were pooled (a weighted average). The
            IQR filter is the team&apos;s own: quartiles from <code>describe().round(2)</code>, applied to mean, median
            and total income in turn. Full details on the <Link href="/methods">data and methods page</Link>.
          </p>
        </div>
      </Section>
    </>
  );
}
