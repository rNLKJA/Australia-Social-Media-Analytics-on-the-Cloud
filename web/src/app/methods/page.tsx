import { Check, Equal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Finding, Note, PageHeader, Section } from "@/components/editorial/page-header";
import { fmtInt } from "@/lib/format";
import { SITE } from "@/lib/site";
import { getFacts, getHistogram } from "@/server/analytics";

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

function Status({ exact }: { exact: boolean }) {
  return exact ? (
    <span className="text-sent-pos inline-flex shrink-0 items-center gap-1 text-xs font-medium">
      <Check className="size-4" aria-hidden /> exact
    </span>
  ) : (
    <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium">
      <Equal className="size-4" aria-hidden /> close
    </span>
  );
}

export default async function MethodsPage() {
  const [facts, twAll] = await Promise.all([getFacts(), getHistogram("twitter", "all")]);
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
            outputs.
          </>
        }
      />

      <Section kicker="Sources" title="Data">
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

      <Section kicker="2023" title="The original processing">
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

      <Section kicker="2026" title="What the revival added">
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

      <Section kicker="Caveats" title="Limitations worth knowing">
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
    </>
  );
}
