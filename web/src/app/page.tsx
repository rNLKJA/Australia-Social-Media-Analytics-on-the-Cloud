import { ArrowRight, FlaskConical, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { SentimentHistogram } from "@/components/charts/sentiment-histogram";
import { Section } from "@/components/editorial/page-header";
import { Github } from "@/components/layout/icons";
import { ArchitectureStory } from "@/components/landing/architecture-story";
import { SuburbDots } from "@/components/landing/suburb-dots";
import { Button } from "@/components/ui/button";
import { fmtInt, fmtPct, fmtR } from "@/lib/format";
import { SITE, TEAM } from "@/lib/site";
import { getCorrelations, getFacts, getHistogram, getIncomeRegions, getSalRegions } from "@/server/analytics";
import { readTopo } from "@/server/geo";

export default async function Home() {
  const [facts, sals, twAll, twCrime, msSocial, msAu, correlations, income, states] = await Promise.all([
    getFacts(),
    getSalRegions(),
    getHistogram("twitter", "all"),
    getHistogram("twitter", "crime"),
    getHistogram("mastodon.social", "all"),
    getHistogram("mastodon.au", "all"),
    getCorrelations(),
    getIncomeRegions(),
    readTopo("aus-states.topo.json"),
  ]);
  const vic = states.features.find((f) => f.properties.name === "Victoria")?.geometry;
  const incomePoints = income
    .filter((r) => r.kept && r.avgIncome !== null && r.tweetsIncome >= 1)
    .map((r) => ({ x: r.medianAud, y: r.avgIncome as number }));
  const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
  const incomeR = correlations.find(
    (c) => c.scenario === "income" && c.yMetric === "avg_income" && c.minTweets === 1,
  )!;
  const salCrime = correlations.find((c) => c.scenario === "crime" && c.unit === "sal" && c.minTweets === 1)!;
  const vicTweets = sals.reduce((a, s) => a + (s.all?.n ?? 0), 0);

  return (
    <>
      {/* ---- hero --------------------------------------------------------------- */}
      <section className="border-border relative overflow-hidden border-b">
        <div className="grain pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-14 pb-12 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-20">
          <div>
            <p className="kicker">
              {SITE.subject.split(" ")[0]} · {SITE.university} · 2023
            </p>
            <h1 className="text-display mt-4 font-serif font-semibold tracking-tight text-balance">
              Does the mood online match life on the ground?
            </h1>
            <p className="text-lede text-muted-foreground mt-6 max-w-xl text-pretty">
              In 2023 a five-person team built a cloud system that read{" "}
              <strong className="text-foreground font-semibold">
                {fmtInt(facts.tweets_processed?.value ?? 37823414)} tweets
              </strong>{" "}
              and harvested{" "}
              <strong className="text-foreground font-semibold">
                {fmtInt(facts.toots_harvested?.value ?? 1659690)} toots
              </strong>
              , scored their sentiment, pinned them to Victorian suburbs and set them against official income
              and crime statistics. This is that project, rebuilt so anyone can explore it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link href="/twitter">
                  <MapIcon aria-hidden /> Explore the sentiment map
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
                <Link href="/pipeline">
                  <FlaskConical aria-hidden /> Score your own post
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <SuburbDots regions={sals} outline={vic} className="mx-auto max-w-[640px]" />
            <div className="text-muted-foreground mt-2 flex flex-col items-center gap-1 text-center text-xs">
              <p>
                {fmtInt(sals.filter((s) => s.all).length)} Victorian suburbs · {fmtInt(vicTweets)} geotagged
                tweets, Feb-Jul 2022
              </p>
              <p className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <span>dot size = tweets</span>
                <span className="inline-flex items-center gap-1">
                  <span className="bg-sent-2 size-2.5 rounded-full" aria-hidden /> more negative
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="bg-sent-5 ring-border size-2.5 rounded-full ring-1" aria-hidden /> neutral
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="bg-sent-8 size-2.5 rounded-full" aria-hidden /> more positive
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- the brief ------------------------------------------------------------ */}
      <Section
        kicker="The brief"
        title="Build a cloud that tells stories about life in Australia"
        intro={
          <>
            <p>
              Assignment 2 of COMP90024 asked each team to use the Melbourne Research Cloud to harvest social
              media, store it in a distributed database, analyse it at scale and present scenarios that
              compare online talk with official data from the Spatial Urban Data Observatory (SUDO), all
              deployed automatically.
            </p>
            <p>
              Team 57 chose two questions: do people in higher- and lower-income areas talk about money
              differently, and does the tone of crime talk follow where crime is recorded?
            </p>
          </>
        }
      >
        <dl className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4">
          {[
            [`${facts.twitter_corpus_gb?.value ?? 57} GB`, "Twitter corpus provided"],
            [fmtInt(facts.tweets_geotagged_couchdb?.value ?? 2418617), "tweets matched to a suburb"],
            [`${facts.couchdb_nodes?.value ?? 3} nodes`, "CouchDB cluster on MRC"],
            [`${facts.mrc_vcpus?.value ?? 8} vCPUs`, "the whole cloud budget"],
          ].map(([v, l]) => (
            <div key={l} className="bg-card px-4 py-5">
              <dd className="num font-serif text-2xl font-semibold md:text-3xl">{v}</dd>
              <dt className="text-muted-foreground mt-1 text-xs">{l}</dt>
            </div>
          ))}
        </dl>
      </Section>

      {/* ---- architecture scrollytelling ---------------------------------------- */}
      <section className="border-border bg-muted/30 border-y">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <p className="kicker">How it worked</p>
          <h2 className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight md:text-4xl">
            From a 57 GB file to a dashboard, in five moves
          </h2>
          <p className="prose-civic text-muted-foreground mt-4">
            Scroll to follow a tweet through the original system. The cloud no longer exists; every number it
            produced has been recovered and checked.
          </p>
          <div className="mt-10">
            <ArchitectureStory />
          </div>
        </div>
      </section>

      {/* ---- findings ------------------------------------------------------------- */}
      <Section
        kicker="What the data says"
        title="Four findings, recomputed"
        intro={<p>Each card links to an interactive page with the full data and method.</p>}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FindingCard
            href="/twitter"
            kicker="Twitter"
            title="Mostly neutral, leaning positive"
            body={`${fmtPct(twAll.counts[4] / sum(twAll.counts))} of geotagged tweets score a neutral 5, and the positive side outweighs the negative. Suburb averages show no geographic pattern.`}
          >
            <SentimentHistogram counts={twAll.counts} label="Sentiment of all geotagged tweets" compact />
          </FindingCard>
          <FindingCard
            href="/income"
            kicker="Scenario 1 · Income"
            title="Richer areas do not tweet happier about money"
            body={`Across ${incomeR.n} SA2 areas, median income and the tone of income tweets barely move together (r = ${fmtR(incomeR.pearsonR)}, explaining ${(incomeR.r2 * 100).toFixed(1)}% of the variation). Income talk is concentrated in Melbourne's CBD.`}
          >
            <MiniScatter
              points={incomePoints}
              fit={{ slope: incomeR.slope, intercept: incomeR.intercept, r: incomeR.pearsonR }}
            />
            <p className="num text-muted-foreground mt-1 text-xs">
              Median income (x) vs average tone of income tweets (y), one dot per SA2 · dashed line: least
              squares
            </p>
          </FindingCard>
          <FindingCard
            href="/crime"
            kicker="Scenario 2 · Crime"
            title="Crime talk is dark everywhere, not darker where crime is high"
            body={`The most common score for crime tweets is 1 (extremely negative). But suburbs with more crime talk are not measurably gloomier (r = ${fmtR(salCrime.pearsonR)}).`}
          >
            <SentimentHistogram counts={twCrime.counts} label="Sentiment of crime-related tweets" compact />
          </FindingCard>
          <FindingCard
            href="/mastodon"
            kicker="Mastodon"
            title="Every server has its own mood, and the lexicon speaks English"
            body="mastodon.social looked almost uniformly neutral in 2023 while mastodon.au resembled Twitter. Re-scoring a surviving week shows why: non-English toots fall to neutral, and German 'die' reads as negative."
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium">mastodon.social</p>
                <SentimentHistogram
                  counts={msSocial.counts}
                  label="mastodon.social sentiment"
                  compact
                  showValues={false}
                />
              </div>
              <div>
                <p className="text-xs font-medium">mastodon.au</p>
                <SentimentHistogram
                  counts={msAu.counts}
                  label="mastodon.au sentiment"
                  compact
                  showValues={false}
                />
              </div>
            </div>
          </FindingCard>
        </div>
      </Section>

      {/* ---- pipeline CTA ----------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-2xl px-6 py-12 md:px-12">
          <div className="grain pointer-events-none absolute inset-0 opacity-20" aria-hidden />
          <div className="relative grid gap-6 md:grid-cols-[1.5fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-80">Hands on</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold md:text-4xl">
                Run the 2023 pipeline in your browser
              </h2>
              <p className="mt-3 max-w-2xl opacity-85">
                The original Python scoring code (NLTK&apos;s tokenisers, WordNet and VADER) has been ported
                to TypeScript and verified against the original on 44,156 real toots. Type a post and watch it
                become a number.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="h-11 px-5 text-base">
              <Link href="/pipeline">
                Open the lab <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ---- about ---------------------------------------------------------------- */}
      <Section id="about" kicker="About this project" title="Who built it, then and now">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Subject</dt>
              <dd>{SITE.subject}</dd>
              <dt className="text-muted-foreground">University</dt>
              <dd>{SITE.university}</dd>
              <dt className="text-muted-foreground">When</dt>
              <dd>{SITE.term}, Assignment 2</dd>
              <dt className="text-muted-foreground">Team</dt>
              <dd>{SITE.team}</dd>
            </dl>
            <ul className="divide-border border-border bg-card divide-y rounded-lg border">
              {TEAM.map((m) => (
                <li
                  key={m.name}
                  className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground text-sm">{m.role}</span>
                </li>
              ))}
            </ul>
            <a
              href={SITE.repo}
              className="text-primary inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <Github className="size-4" /> rNLKJA/Australia-Social-Media-Analytics-on-the-Cloud
            </a>
          </div>
          <div className="space-y-6">
            <div className="border-border bg-card relative overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">Original stack compared with the revived stack</caption>
                <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium" />
                    <th scope="col" className="px-4 py-2 font-medium">
                      2023 original
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      2026 revival
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Compute",
                      "Melbourne Research Cloud, 6 instances",
                      "Static pages + serverless functions (Vercel)",
                    ],
                    [
                      "Data store",
                      "CouchDB 3.2 cluster, 3 nodes, ~400 GB",
                      "SQLite analytics.db, 1.7 MB, read-only",
                    ],
                    ["Processing", "mpi4py, MapReduce views", "uv scripts re-running the original code"],
                    ["Backend", "Flask + Gunicorn, gzipped Plotly JSON", "Next.js Server Components"],
                    ["Frontend", "React 18, MUI, Plotly, Tailwind", "Next.js 16, Tailwind v4, MapLibre, SVG"],
                    ["Maps", "Plotly mapbox, 37-46 MB per map", "OpenFreeMap tiles + 1.2 MB of TopoJSON"],
                    ["Sentiment", "NLTK 3.8.1 in Python", "Same algorithm, ported to TypeScript"],
                    ["Deployment", "Ansible + Docker Swarm", "git push"],
                  ].map(([k, a, b]) => (
                    <tr key={k} className="border-border/70 border-t align-top">
                      <th scope="row" className="px-4 py-2 text-left font-medium">
                        {k}
                      </th>
                      <td className="text-muted-foreground px-4 py-2">{a}</td>
                      <td className="px-4 py-2">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <strong className="text-foreground">Academic integrity.</strong> The original submission is
              preserved unchanged in the repository&apos;s <code>coursework/</code> folder for reference. The
              revival rebuilds the presentation and re-runs the team&apos;s own code; it does not alter the
              methods or the conclusions. The assignment specification and course-provided raw data are not
              published here.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

function FindingCard({
  href,
  kicker,
  title,
  body,
  children,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <article className="group border-border bg-card hover:border-primary/50 relative flex flex-col rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <p className="kicker">{kicker}</p>
      <h3 className="mt-2 font-serif text-2xl leading-snug font-semibold">
        <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
          {title}
        </Link>
      </h3>
      <p className="text-muted-foreground mt-3 text-[0.96rem] leading-relaxed">{body}</p>
      <div className="mt-5 w-full max-w-md">{children}</div>
      <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
        Explore <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </article>
  );
}

/** Static mini scatter of the real scenario 1 points with the stored least-squares line. */
function MiniScatter({
  points,
  fit,
}: {
  points: { x: number; y: number }[];
  fit: { slope: number; intercept: number; r: number };
}) {
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const X = (v: number) => 10 + ((v - x0) / (x1 - x0)) * 280;
  const Y = (v: number) => 112 - ((v - 1) / 8) * 104;
  return (
    <svg
      viewBox="0 0 300 120"
      className="w-full"
      role="img"
      aria-label={`${points.length} SA2 areas: median income against average sentiment of income tweets, r = ${fit.r.toFixed(2)}`}
    >
      <line x1={0} x2={300} y1={Y(5)} y2={Y(5)} stroke="var(--rule)" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={X(p.x)}
          cy={Y(p.y)}
          r={2.6}
          fill={p.y >= 5 ? "var(--sent-7)" : "var(--sent-3)"}
          fillOpacity={0.75}
        />
      ))}
      <line
        x1={X(x0)}
        x2={X(x1)}
        y1={Y(fit.intercept + fit.slope * x0)}
        y2={Y(fit.intercept + fit.slope * x1)}
        stroke="var(--foreground)"
        strokeDasharray="5 4"
        strokeWidth={1.5}
      />
    </svg>
  );
}
