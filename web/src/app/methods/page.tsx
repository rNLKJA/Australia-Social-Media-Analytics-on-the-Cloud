import { ArrowRight, Check, Equal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AreaCaveats } from "@/components/editorial/caveats";
import { Finding, Note, PageHeader, Section } from "@/components/editorial/page-header";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { fmtInt } from "@/lib/format";
import { SITE } from "@/lib/site";
import { getFacts, getHistogram } from "@/server/analytics";
import { listDecisions } from "@/server/content";

export const metadata: Metadata = {
  title: "Data & methods",
  description:
    "Sources, processing steps, the reproduction checks run against the 2023 outputs, and the limitations of the Social Sense analysis.",
};

const SOURCES = [
  {
    name: "Twitter corpus",
    detail:
      "57 GB of tweets supplied by the University via the Australian Data Observatory. The team processed 15.9 GB (37.8 million tweets) before the deadline; 2.42 million carried a place that matched a suburb.",
    used: "Per-suburb counts and score sums from three CouchDB MapReduce views (all, income, crime), February-July 2022.",
    licence: "Licensed for coursework; only aggregates are published here.",
  },
  {
    name: "Mastodon",
    detail:
      "Public timelines of mastodon.social, mastodon.au and tictoc.social, harvested every ten minutes (40 toots per request) from 31 Dec 2021; 1.66 million toots by May 2023.",
    used: "The dashboard's histograms, plus one surviving week of raw mastodon.social toots (2-9 May 2023) re-scored for hourly and language aggregates.",
    licence: "Public posts; no text, ids or usernames are stored here.",
  },
  {
    name: "SUDO: personal income",
    detail:
      "ABS personal income by SA2 (2015-16), mean, median, sum and median age of earners, on 2016 SA2 boundaries.",
    used: "Scenario 1 and the capital-city summary.",
    licence: "ABS data via the Spatial Urban Data Observatory.",
  },
  {
    name: "SUDO: jobs and income by industry",
    detail: "ABS Jobs in Australia 2018-19, employee jobs and median income per job by industry and SA2.",
    used: "The industry bar chart on the income page (as summarised in 2023).",
    licence: "ABS data via SUDO.",
  },
  {
    name: "SUDO: criminal incidents",
    detail:
      "Crime Statistics Agency Victoria, offences by division per LGA (2011 LGA codes), reference year 2019.",
    used: "Scenario 2.",
    licence: "Crime Statistics Agency Victoria via SUDO.",
  },
  {
    name: "Boundaries",
    detail:
      "ABS ASGS suburbs and localities (SAL 2021), SA2 (2016), LGA (2019) and GCCSA (2021, dissolved to states).",
    used: "Choropleths (simplified to 6-8% of vertices with mapshaper) and the suburb-to-area crosswalk.",
    licence: "© Australian Bureau of Statistics, CC BY 4.0.",
  },
];

const TOC = [
  ["sources", "Data"],
  ["original", "2023 processing"],
  ["revival", "2026 revival"],
  ["reproduction", "Reproduction checks"],
  ["evaluation", "Uncertainty"],
  ["spatial", "Spatial caveats"],
  ["limitations", "Limitations & assumptions"],
  ["ai-use", "AI use statement"],
  ["model-card", "Model card"],
  ["decisions", "Decision records"],
  ["change", "What I'd change"],
] as const;

const UNCERTAINTY = [
  {
    what: "An area's average sentiment",
    how: "Tweet count and a t-based 95% interval from the CouchDB _stats sums (count, sum, sum of squares); areas under 30 tweets flagged or suppressed (DR-003)",
    ref: "scipy.stats.t",
  },
  {
    what: "Proportions (benchmark accuracy, refusal rate, neutral share by language)",
    how: "Wilson score 95% interval, with k and n shown",
    ref: "statsmodels proportion_confint",
  },
  {
    what: "Income or offences against sentiment",
    how: "Spearman's rho with a paired percentile bootstrap (2,000 resamples, seed 57); OLS slope with HC3 robust standard error; residual Moran's I",
    ref: "scipy.stats.bootstrap, statsmodels OLS",
  },
  {
    what: "Spatial clustering",
    how: "Global Moran's I with analytic moments and a 999-permutation p-value (seed 57); local Moran's I with conditional permutation, two-sided, optional Benjamini-Hochberg",
    ref: "PySAL esda Moran, Moran_Local",
  },
  {
    what: "Neighbours",
    how: "6 nearest representative points, or shared borders read from the TopoJSON arcs (islands dropped and counted)",
    ref: "libpysal KNN, Rook",
  },
  {
    what: "Two AI models compared",
    how: "Paired by question; exact McNemar test on the discordant questions, and the accuracy difference with a Tango score 95% interval",
    ref: "statsmodels mcnemar(exact=True), R PropCIs scoreci.mp",
  },
  {
    what: "Model latency",
    how: "Median with a percentile bootstrap interval",
    ref: "numpy percentile",
  },
] as const;

function Status({ exact }: { exact: boolean }) {
  return exact ? (
    <span className="text-sent-pos-ink inline-flex shrink-0 items-center gap-1 text-xs font-medium">
      <Check className="size-4" aria-hidden /> exact
    </span>
  ) : (
    <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium">
      <Equal className="size-4" aria-hidden /> close
    </span>
  );
}

export default async function MethodsPage() {
  const [facts, twAll, decisions] = await Promise.all([
    getFacts(),
    getHistogram("twitter", "all"),
    listDecisions(),
  ]);
  const viewTotal = twAll.counts.reduce((a, b) => a + b, 0);

  const checks: { claim: string; source: string; result: string; exact: boolean }[] = [
    {
      claim:
        'Notebook example normalises to "Hello ~ What a good weather ! hahahhah , lmao ! ! …" and the raw string scores 8',
      source: "Sentimental Analysis.ipynb",
      result:
        "Identical string and score in the TypeScript port (the processor scored the normalised text, which gives 9)",
      exact: true,
    },
    {
      claim: "Every count and rounded average on the 1,085-suburb Twitter map (3 topics × 2 measures)",
      source: "twitter_vic_sal_2022_02_2022_07.json.gz",
      result: "All 6,510 values identical",
      exact: true,
    },
    {
      claim: "2,418,621 tweets contained geographical data",
      source: "Report 4.1",
      result: `${fmtInt(viewTotal)} in the saved CouchDB view (4 fewer)`,
      exact: false,
    },
    {
      claim: "420 Victorian SA2s after outlier removal; Merbein lowest ($28,996), Sydenham highest ($62,029)",
      source: "Report 6.2.1",
      result: "Reproduced with the team's IQR rule in Python and TypeScript",
      exact: true,
    },
    {
      claim: "Income tweets: 73% of regions with 1-10, 22% with 10-100, 4.7% over 100; Melbourne 23,281",
      source: "Report 6.2.2",
      result: "73.2% / 22.0% / 4.7% (bins < 10, 10-99, ≥ 100); 23,281",
      exact: true,
    },
    {
      claim: "72 LGAs after outlier removal, Brimbank highest",
      source: "Report 6.3.1, crime map",
      result: "Same 72 LGAs as the original map; Brimbank 14,670 offences",
      exact: true,
    },
    {
      claim: "Crime tweets: 79% / 18% / 3% of regions; Melbourne 4,026, Ballarat 485",
      source: "Report 6.3.2",
      result: "79.4% / 17.6% / 2.9% (bins ≤ 10, 11-100, > 100); 4,026; 485",
      exact: true,
    },
    {
      claim: "All six offence divisions for 79 LGAs",
      source: "crime_vic_lga_bar.json.gz",
      result: "All 474 bar heights identical",
      exact: true,
    },
    {
      claim:
        "Rest of WA highest mean (71.5k), ACT highest median (60.2k), Rest of Vic. lowest (49.6k / 41.4k)",
      source: "SUDO summary",
      result: "Reproduced from 2,234 SA2s grouped by GCCSA",
      exact: true,
    },
    {
      claim: "mastodon.social scores packed around 5",
      source: "Report 6.1, dashboard histogram",
      result: "Different week re-scored: 61% neutral vs 79% (still the most neutral server)",
      exact: false,
    },
  ];

  return (
    <>
      <PageHeader
        kicker="Data & methods"
        title="Where the numbers come from, and how far to trust them"
        lede={
          <>
            Social Sense was a five-person cloud computing project. This page documents the data, the original
            processing, what the revival recomputed and the checks that tie every chart back to the 2023
            outputs, then how uncertainty is reported, what the optional AI does, and the decisions behind it.
          </>
        }
      >
        <nav aria-label="On this page">
          <ul className="flex flex-wrap gap-2 text-sm">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="border-border bg-card hover:border-primary/60 inline-block rounded-full border px-3 py-1"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHeader>

      <Section id="sources" kicker="Sources" title="Data">
        {/* phones: one card per source; wider screens: a table */}
        <ul className="space-y-3 sm:hidden">
          {SOURCES.map((s) => (
            <li key={s.name} className="border-border bg-card rounded-lg border p-4 text-sm">
              <p className="font-medium">{s.name}</p>
              <p className="text-muted-foreground mt-1">{s.detail}</p>
              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="text-muted-foreground text-xs font-medium">How it is used here</dt>
                  <dd>{s.used}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-medium">Terms</dt>
                  <dd className="text-xs">{s.licence}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="border-border bg-card relative hidden overflow-x-auto rounded-lg border sm:block">
          <table className="w-full text-sm">
            <caption className="sr-only">Data sources</caption>
            <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Source
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  What it is
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  How it is used here
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Terms
                </th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.name} className="border-border/70 border-t align-top">
                  <th scope="row" className="px-4 py-3 text-left font-medium lg:whitespace-nowrap">
                    {s.name}
                  </th>
                  <td className="text-muted-foreground px-4 py-3">{s.detail}</td>
                  <td className="text-muted-foreground px-4 py-3">{s.used}</td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">{s.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note className="mt-3">
          The assignment specification and the raw course datasets are not reproduced on this site. The
          team&apos;s report is kept in the repository under <code>coursework/</code>.
        </Note>
      </Section>

      <Section id="original" kicker="2023" title="The original processing">
        <div className="grid gap-8 lg:grid-cols-2">
          <ol className="space-y-4 text-[0.98rem]">
            {[
              ["Split the corpus", "mpi4py ranks each read a byte range of the 57 GB file, line by line."],
              [
                "Extract with regular expressions",
                "Tweet id, author, date, place and text, without parsing the JSON.",
              ],
              [
                "Clean and score",
                "Strip mentions, hashtags and links; tokenise, lemmatise, VADER; bucket the compound score into 1-9.",
              ],
              [
                "Geocode",
                "Normalise the place name and match word combinations against a dictionary of 2021 suburbs.",
              ],
              [
                "Load CouchDB",
                "Bulk uploads of 1,000 documents into a three-node cluster; one database for geotagged tweets.",
              ],
              [
                "MapReduce",
                "Views emit each tweet's score by suburb (all tweets, income keywords, crime keywords) with a _stats reduce.",
              ],
              [
                "Serve",
                "Flask turned the views into gzipped Plotly figures; React drew them beside the SUDO maps.",
              ],
            ].map(([h, d], i) => (
              <li key={h} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="num border-border grid size-7 place-items-center rounded-full border font-serif text-sm">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{h}</p>
                  <p className="text-muted-foreground text-sm">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="space-y-5">
            <Finding title="Infrastructure">
              <p>
                Eight vCPUs and 500 GB on the Melbourne Research Cloud: a CouchDB cluster (one 2-core master,
                two 1-core replicas, 400 GB of volumes), Flask and React as Docker Swarm services, and Ansible
                playbooks to create instances, volumes, security groups and the cluster, and to scale
                services.
              </p>
            </Finding>
            <p className="prose-civic text-muted-foreground">
              The cloud is gone, but the steps that produced numbers are preserved in <code>coursework/</code>{" "}
              and re-run by the scripts in <code>scripts/</code>. You can run steps 3-4 yourself on the{" "}
              <Link href="/pipeline">pipeline page</Link>.
            </p>
          </div>
        </div>
      </Section>

      <Section id="revival" kicker="2026" title="What the revival added">
        <div className="prose-civic text-muted-foreground">
          <p>
            <strong className="text-foreground">A read-only database.</strong>{" "}
            <code>scripts/build_analytics.py</code> re-runs the Flask backend&apos;s functions on the saved
            CouchDB view exports and SUDO files, asserts that the results match the shipped Plotly figures,
            and writes <Link href="/records">analytics.db</Link> (1.7 MB) plus simplified TopoJSON boundaries.
          </p>
          <p>
            <strong className="text-foreground">A crosswalk.</strong> Tweets were geocoded to 2021 suburbs
            (SAL) while income uses 2016 SA2s and crime uses 2019 LGAs. Each suburb is assigned to the SA2 and
            LGA containing its representative point, and counts and score sums are pooled. All 1,085 Victorian
            suburbs with tweets fall inside an SA2 and an LGA. This step is new: in 2023 the comparison was
            visual only.
          </p>
          <p>
            <strong className="text-foreground">Correlations.</strong> Pearson r, Spearman ρ and a
            least-squares line at minimum-tweet thresholds of 1, 5, 10 and 30, computed with scipy at build
            time and again in your browser by a TypeScript port that is unit-tested against the scipy values.
          </p>
          <p>
            <strong className="text-foreground">The NLP pipeline in the browser.</strong> NLTK 3.8.1&apos;s
            Punkt sentence splitter, word tokeniser, WordNet noun lemmatiser and VADER, plus the BeautifulSoup
            HTML-to-text step the Mastodon harvester used, ported to TypeScript and verified to reproduce the
            original Python on every test post and on 44,156 real toots.
          </p>
        </div>
      </Section>

      <Section
        id="reproduction"
        kicker="Reproduction"
        title="Checks against the 2023 outputs"
        intro={
          <p>
            Rows marked exact are asserted by the build script or by the test suite, which CI runs on every
            push. Rows marked close are reported for transparency.
          </p>
        }
      >
        <ul className="space-y-3 sm:hidden">
          {checks.map((c) => (
            <li key={c.claim} className="border-border bg-card rounded-lg border p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p>{c.claim}</p>
                <Status exact={c.exact} />
              </div>
              <p className="text-muted-foreground mt-2">
                <span className="text-foreground text-xs font-medium">Reproduced: </span>
                {c.result}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{c.source}</p>
            </li>
          ))}
        </ul>
        <div className="border-border bg-card relative hidden overflow-x-auto rounded-lg border sm:block">
          <table className="w-full text-sm">
            <caption className="sr-only">Reproduction checks</caption>
            <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  2023 claim or output
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Where
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Reproduced
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Status</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.claim} className="border-border/70 border-t align-top">
                  <td className="px-4 py-3">{c.claim}</td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">{c.source}</td>
                  <td className="text-muted-foreground px-4 py-3">{c.result}</td>
                  <td className="px-4 py-3">
                    <Status exact={c.exact} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="evaluation"
        kicker="2026 upgrade · rigour"
        title="How uncertainty is reported, and how the statistics are checked"
        intro={
          <p>
            Every quantitative result added in the upgrade carries a sample size and an interval, resampling
            uses a fixed seed (57, for Team 57) that the page displays, and every TypeScript statistic is
            compared in CI with the standard Python implementation by <code>scripts/verify_stats.py</code>.
          </p>
        }
      >
        <ScrollRegion
          label="Uncertainty methods (scrolls sideways)"
          className="border-border bg-card relative rounded-lg border"
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Uncertainty methods</caption>
            <thead className="bg-muted/60 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Quantity
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Uncertainty shown
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Verified against
                </th>
              </tr>
            </thead>
            <tbody>
              {UNCERTAINTY.map((u) => (
                <tr key={u.what} className="border-border/70 border-t align-top">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {u.what}
                  </th>
                  <td className="text-muted-foreground px-4 py-3">{u.how}</td>
                  <td className="text-muted-foreground px-4 py-3 font-mono text-xs">{u.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
        <div className="prose-civic text-muted-foreground mt-6">
          <p>
            Analytic quantities agree with the Python reference to between 1e-9 and 1e-12; permutation and
            bootstrap quantities, which use different random streams, agree within Monte Carlo error.
            Contiguity built from the site&apos;s own TopoJSON matches libpysal&apos;s rook neighbours on the
            same files exactly (2,472 SA2 links, 410 LGA links). Ties in permutation tests count against
            significance.
          </p>
          <p>
            Comparisons are reported, not ranked: the spatial page shows a sensitivity table across
            thresholds, neighbour definitions and area units rather than the most striking combination, and
            nothing is corrected for the number of looks, which is said where it matters.
          </p>
        </div>
      </Section>

      <Section
        id="spatial"
        kicker="Areas, not people"
        title="Spatial statistics and their caveats"
        intro={
          <p>
            The <Link href="/spatial">spatial statistics page</Link> tests whether neighbouring areas share a
            mood (global and local Moran&apos;s I). Its main result is negative: the clustering that appears
            when every area with a tweet counts disappears once averages built on fewer than 30 tweets are
            suppressed (<Link href="/methods/decisions/DR-003-small-area-suppression">DR-003</Link>).
          </p>
        }
      >
        <AreaCaveats unit="area" />
      </Section>

      <Section id="limitations" kicker="Caveats" title="Limitations worth knowing">
        <ul className="grid gap-4 md:grid-cols-2">
          {[
            [
              "Different years",
              "Income is 2015-16, offences 2019, tweets 2022. The comparison assumes regional patterns are stable.",
            ],
            [
              "Self-reported places",
              'Twitter\'s place field is often a city, not a suburb: "Melbourne, Victoria" lands in the CBD suburb, inflating its counts.',
            ],
            [
              "The shortest match wins",
              'The geocoder tries word combinations shortest first and keeps the first known place, so "Albert Park, Victoria" lands in Albert (NSW), "St Kilda, Victoria" in St Kilda (SA), and Port, North and South Melbourne in Melbourne. 579 of the 3,118 Victorian place keys are shadowed this way and 432 of 2,921 Victorian suburbs can never be matched, which is why St Kilda and Albert Park are missing from the map and why Port Phillip loses tweets to the City of Melbourne. The port keeps this behaviour.',
            ],
            [
              "Small samples",
              "Most suburbs have a handful of topic tweets, so their averages are noisy. The threshold slider exists for this reason.",
            ],
            [
              "A lexicon, not a reader",
              "VADER scores words, not meaning; sarcasm, slang and non-English text are scored poorly or as neutral.",
            ],
            [
              "The outlier rule",
              "The IQR filter removes the busiest LGAs (Melbourne, Casey, Geelong), which are also where most crime tweets are.",
            ],
            [
              "Correlation only",
              "Even a clear correlation between areas would say nothing about individuals (the ecological fallacy).",
            ],
          ].map(([h, d]) => (
            <li key={h} className="border-border bg-card rounded-lg border p-4">
              <p className="font-medium">{h}</p>
              <p className="text-muted-foreground mt-1 text-sm">{d}</p>
            </li>
          ))}
        </ul>
        <Note className="mt-6">
          {SITE.subject} · {SITE.university} · {SITE.term}. Key figures:{" "}
          {fmtInt(facts.tweets_processed?.value ?? 0)} tweets processed,{" "}
          {fmtInt(facts.toots_harvested?.value ?? 0)} toots harvested.{" "}
          <a className="link" href={SITE.repo}>
            Source code and original submission on GitHub
          </a>
          .
        </Note>
      </Section>

      <Section id="assumptions" kicker="Assumptions" title="What the analysis takes for granted">
        <ul className="grid gap-3 md:grid-cols-2">
          {[
            [
              "Stable geography of mood",
              "Income (2015-16), offences (2019) and tweets (2022) are compared as if each area's position had not changed.",
            ],
            [
              "Independent tweets",
              "Standard errors treat every tweet as a separate draw. Prolific accounts and repeated posts break this, so intervals are optimistic. No user identifiers were kept, so it cannot be corrected.",
            ],
            [
              "Place tags mean place",
              "A tweet's self-reported place is where it is counted, whatever the author's home or the subject of the tweet.",
            ],
            [
              "A suburb belongs to one SA2 and one LGA",
              "Each suburb is assigned by its representative point; suburbs that straddle boundaries are not split.",
            ],
            [
              "Neighbours",
              "Spatial weights are six nearest areas by default, or shared borders; results are shown under both.",
            ],
            [
              "The team's outlier rule",
              "Scenario relationships use the areas the 2023 IQR filter kept, unless a reader brings the outliers back.",
            ],
          ].map(([h, d]) => (
            <li key={h} className="border-border bg-card rounded-lg border p-4">
              <p className="font-medium">{h}</p>
              <p className="text-muted-foreground mt-1 text-sm">{d}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="ai-use"
        kicker="AI use statement"
        title="What AI does on this site, and what it never does"
        intro={
          <p>
            AI is optional here and runs only on a visitor&apos;s own key. This statement is informed by the
            transparency principles of the Australian Government&apos;s policy for the responsible use of AI
            in government, the EU AI Act&apos;s transparency obligations and the NIST AI Risk Management
            Framework. It does not claim compliance with any of them.
          </p>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [
              "What it does",
              "On /ask, a language model the visitor chooses turns a question into one SQL query and then explains the returned rows in up to three sentences that cite them. On /ask/eval, the same model answers 16 benchmark questions so the visitor can measure it. That is all.",
            ],
            [
              "What it never does",
              "It never produced any number elsewhere on the site: every chart, statistic and finding comes from the 2023 pipeline and the revival's tested code. It never touches the database directly, never writes data, never runs on this site's servers and never sees a key belonging to the project (there is none).",
            ],
            [
              "Data sent to the provider",
              "From the visitor's browser, with their key: the question exactly as typed, the documented schema, the generated SQL and up to 30 result rows of public aggregates. The database holds no personal data, but anything typed into the question is sent as is, so do not include personal information. This site's server receives only the SQL.",
            ],
            [
              "Human in the loop",
              "Every output is labelled AI-generated. The SQL is shown and editable, the validator's verdict and the rows are shown, citations are checked against the rows, and the person records a decision: accepted, edited or rejected.",
            ],
            [
              "Records",
              "Each question (two model calls: writing the SQL, then explaining the rows) is logged as one record in the visitor's browser (IndexedDB): id, time, feature, provider, model, question, generated SQL, what the explanation call was sent (the SQL and the number of rows), validator verdict, row count, answer, end-to-end latency, token usage and the decision with its time. Each benchmark question is one record. Re-running edited SQL adds a new record linked to the original; once written, only the decision changes. Viewable and exportable as JSON or CSV at /ai-log. Keys are redacted before every write.",
            ],
            [
              "Measurement and limits",
              "The benchmark reports accuracy with Wilson intervals, counts malformed or truncated replies as wrong, and compares models with a paired exact test and a score interval for the difference. The project publishes no AI scores of its own. Known failure modes are listed in the model card.",
            ],
          ].map(([h, d]) => (
            <div key={h} className="border-border bg-card rounded-lg border p-4">
              <p className="font-medium">{h}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link className="link inline-flex items-center gap-1" href="/ask">
            Ask the data <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link className="link inline-flex items-center gap-1" href="/ai-log">
            AI audit log <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            className="link inline-flex items-center gap-1"
            href="/methods/decisions/DR-004-byok-text-to-sql"
          >
            Why it works this way (DR-004) <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Section>

      <Section
        id="model-card"
        kicker="Model card"
        title="Two models, documented"
        intro={
          <p>
            The 2023 sentiment scorer (VADER in NLTK, wrapped in the team&apos;s pipeline) and the optional
            text-to-SQL assistant each get intended use, provenance, evaluation, failure modes and ethical
            considerations.
          </p>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border-border bg-card rounded-lg border p-4 text-sm">
            <p className="font-medium">Sentiment scorer</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              Reproduced exactly by the TypeScript port (0 mismatches in 44,156 real toots; Wilson upper bound
              0.009%). Accuracy against human judgement was not measured here. Its clearest failure is
              language: in the re-scored Mastodon week, 45% of English toots score neutral against 98% of
              Japanese ones.
            </p>
          </div>
          <div className="border-border bg-card rounded-lg border p-4 text-sm">
            <p className="font-medium">Ask the data</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              A third-party model chosen and paid for by the visitor, contained by server-side validation and
              read-only execution, measured by a 16-question benchmark the visitor runs. No accuracy is
              claimed.
            </p>
          </div>
        </div>
        <Link className="link mt-6 inline-flex items-center gap-1 text-sm" href="/methods/model-card">
          Read the full model card <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Section>

      <Section
        id="decisions"
        kicker="Decision records"
        title="The decisions behind the revival and the upgrade"
        intro={
          <p>
            Each record states the decision first, the options and the reasons, then what actually happened,
            including the weak numbers, and what I would change. Records are never edited to change a
            decision; a new record supersedes an old one.
          </p>
        }
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {decisions.map((d) => (
            <li
              key={d.slug}
              className="group border-border bg-card hover:border-primary/60 relative rounded-lg border p-4 transition-colors"
            >
              <p className="text-muted-foreground font-mono text-xs">{d.id}</p>
              <p className="mt-1 font-medium">
                <Link
                  href={`/methods/decisions/${d.slug}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none"
                >
                  {d.title}
                </Link>
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {d.status} · {d.decided}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="change" kicker="Next" title="What I'd change">
        <ul className="grid gap-3 md:grid-cols-2">
          {[
            [
              "Shrink, don't suppress",
              "Replace the 30-tweet cut with partial pooling (empirical Bayes or a multilevel model) so small areas borrow strength from their neighbours instead of disappearing.",
            ],
            [
              "Measure the scorer",
              "Hand-label a stratified sample of a few hundred posts to estimate VADER's agreement with people on this data, with intervals, before reading anything into small differences in tone.",
            ],
            [
              "Effective sample size",
              "Keep a count of distinct accounts per area in any future pipeline, so intervals can account for prolific posters.",
            ],
            [
              "Pre-register the comparisons",
              "Fix the thresholds and the tests before looking at the data, instead of reporting a sensitivity table afterwards.",
            ],
            [
              "A bigger text-to-SQL benchmark",
              "Fifty or more questions with a held-out half, so a prompt cannot be tuned to the test, and a tamper-evident audit log.",
            ],
            [
              "Rate-limit the SQL endpoint",
              "The validator bounds each query, but nothing bounds how many arrive.",
            ],
          ].map(([h, d]) => (
            <li key={h} className="border-border bg-card rounded-lg border p-4">
              <p className="font-medium">{h}</p>
              <p className="text-muted-foreground mt-1 text-sm">{d}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
