<div align="center">

# Social Sense: Australia Social Media Analytics on the Cloud

**Does the mood online match life on the ground?** A University of Melbourne cloud computing project (COMP90024, 2023) that scored 2.4 million geotagged tweets and 1.7 million Mastodon toots for sentiment and set them against official income and crime statistics, revived in 2026 as an interactive, read-only website, then upgraded with uncertainty, spatial statistics and an optional, auditable bring-your-own-key AI feature.

**Live demo:** [comp90024-social-sense.vercel.app](https://comp90024-social-sense.vercel.app) · **[Guided tour](https://comp90024-social-sense.vercel.app/tour)** (three short walkthrough videos)

[![CI](https://github.com/rNLKJA/Australia-Social-Media-Analytics-on-the-Cloud/actions/workflows/ci.yml/badge.svg)](https://github.com/rNLKJA/Australia-Social-Media-Analytics-on-the-Cloud/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

## Showcase

<p align="center">
  <img src="docs/showcase/the-story.gif" alt="The story walkthrough: the landing page and the scroll-driven diagram of the original 2023 cloud system" width="960">
</p>

**[Take the guided tour](https://comp90024-social-sense.vercel.app/tour)**: three short captioned walkthroughs (MP4 with WebVTT captions and a written transcript) and every screenshot below in a lightbox. All of it was recorded by a reproducible Playwright script, [`web/e2e/showcase.spec.ts`](web/e2e/showcase.spec.ts) (`cd web && pnpm showcase`), which doubles as an end-to-end test: it asserts what each step shows (the recovered 2023 numbers, the live correlation, Moran's I at two thresholds, the validator verdict, the audit-log record), so a broken feature fails the recording. The statistics use the site's fixed seed 57. No real API key was used: in walkthrough 3 the key is a placeholder and the model's reply is a clearly labelled mock, while the SQL it returns still goes through the real validator and runs on the real read-only database.

### Key features

| | |
| --- | --- |
| <img src="docs/showcase/01-landing-light.png" alt="Landing page" width="440"><br>**Landing page.** The question, and Victoria's geotagged tweets drawn as one dot per suburb. | <img src="docs/showcase/02-landing-dark.png" alt="Landing page, dark mode" width="440"><br>**Landing page, dark mode.** The same hero in dark mode. |
| <img src="docs/showcase/03-architecture.png" alt="The original cloud system" width="440"><br>**The original cloud system.** A scroll-driven diagram of the 2023 MPI, CouchDB, Flask and React system. | <img src="docs/showcase/04-sentiment-map.png" alt="Suburb sentiment map" width="440"><br>**Suburb sentiment map.** Average tone of geotagged tweets per suburb, by topic, with a tweet threshold. |
| <img src="docs/showcase/05-income-explorer.png" alt="Scenario 1: income" width="440"><br>**Scenario 1: income.** SA2 income choropleth linked to a sentiment scatter; the correlation is recomputed live. | <img src="docs/showcase/06-income-uncertainty.png" alt="How sure can we be?" width="440"><br>**How sure can we be?** Spearman's rho with a bootstrap interval, HC3 slope and residual Moran's I. |
| <img src="docs/showcase/07-crime-explorer.png" alt="Scenario 2: crime" width="440"><br>**Scenario 2: crime.** Recorded offences by LGA against the tone of crime tweets. | <img src="docs/showcase/08-spatial-lisa.png" alt="Spatial statistics" width="440"><br>**Spatial statistics.** Global Moran's I with a permutation test and the LISA cluster map. |
| <img src="docs/showcase/09-mastodon.png" alt="Mastodon: VADER only speaks English" width="440"><br>**Mastodon: VADER only speaks English.** Neutral share and mean score by language, with intervals, from a re-scored week of toots. | <img src="docs/showcase/10-pipeline.png" alt="The 2023 pipeline in your browser" width="440"><br>**The 2023 pipeline in your browser.** The ported NLTK and VADER code path scores a post step by step. |
| <img src="docs/showcase/11-ai-settings.png" alt="Bring your own key" width="440"><br>**Bring your own key.** AI settings: Anthropic by default; the key stays in this browser. | <img src="docs/showcase/12-ask-mocked-answer.png" alt="Ask the data (mocked reply)" width="440"><br>**Ask the data (mocked reply).** Validated SQL, cited rows and a human decision. The model reply is mocked. |
| <img src="docs/showcase/13-ask-eval.png" alt="Text-to-SQL benchmark" width="440"><br>**Text-to-SQL benchmark.** 16 questions with hand-written gold SQL, run on your own key; nothing is pre-scored. | <img src="docs/showcase/14-ai-log.png" alt="AI audit log" width="440"><br>**AI audit log.** Every AI call from this browser, with the human decision; JSON and CSV export. |
| <img src="docs/showcase/15-methods.png" alt="Data and methods" width="440"><br>**Data and methods.** How uncertainty is reported and how the statistics are checked against Python. | <img src="docs/showcase/16-records.png" alt="Records" width="440"><br>**Records.** Every table of the read-only database, searchable and exportable as CSV. |
| <img src="docs/showcase/17-mobile-landing.png" alt="Mobile: landing" width="220"><br>**Mobile: landing.** The landing page on a 390 px phone. | <img src="docs/showcase/18-mobile-income.png" alt="Mobile: Scenario 1" width="220"><br>**Mobile: Scenario 1.** The income scatter and correlations on a phone. |
| <img src="docs/showcase/19-mobile-spatial.png" alt="Mobile: spatial statistics" width="220"><br>**Mobile: spatial statistics.** Moran's I and the LISA map on a phone. |  |

### Workflow walkthrough

The steps below are the on-screen captions of each recording, in order.

#### 1. The story (`/`)

The landing page from top to bottom: the question, Victoria's geotagged tweets drawn as suburb dots, the 2023 brief, the original cloud system animated step by step as you scroll, the four recomputed findings and the 2026 upgrade.

1. The question: does the mood online match life on the ground?
2. Every dot is a Victorian suburb: size is tweet volume, colour is average tone
3. The 2023 brief: harvest, store, analyse and compare with official data, on 8 vCPUs
4. How it worked: scroll to follow a tweet through the original cloud system
5. Harvest: MPI ranks split the 57 GB file; harvesters poll three Mastodon servers
6. Score and store: VADER on a 1-9 scale, bulk-loaded into a three-node CouchDB cluster
7. Summarise: MapReduce views keep a count, sum, min and max for every suburb
8. Serve and compare: a Flask API joins the views with SUDO income and crime data
9. Automate: Ansible and Docker Swarm on the Melbourne Research Cloud
10. Four findings, recomputed from the recovered numbers
11. The 2026 upgrade: intervals, spatial statistics and an optional, audited AI

*Setup:* No input needed: every number is recovered from the 2023 outputs or recomputed by scripts/.

#### 2. Income vs sentiment (`/income` → `/spatial`)

Scenario 1 end to end: the SA2 income choropleth linked to a scatter of tweet sentiment, the map recoloured by mood, a selected area with its interval, the correlation recomputed live at higher thresholds, the bootstrap interval, then Moran's I and the LISA cluster map on /spatial, and the caveats that come with them.

<img src="docs/showcase/income-vs-sentiment.gif" alt="Income vs sentiment walkthrough" width="960">

1. Scenario 1: do richer areas tweet more happily about money?
2. The choropleth: median personal income for 420 Victorian SA2s (ABS, 2015-16)
3. The linked scatter: one dot per SA2, sized by its income tweets
4. Recolour the map by the mood of income tweets instead
5. Select Ballarat: the map, the chart and the detail panel follow, with a 95% interval
6. Raise the tweet threshold: the correlation is recomputed in the browser
7. How sure? Spearman's rho 0.10, bootstrap 95% CI -0.06 to 0.26, which includes zero
8. Spatial statistics: is the mood clustered in space, or is it noise?
9. Global Moran's I = 0.022, permutation p = 0.24 across 152 SA2s: no evidence of clustering
10. The LISA cluster map: High-High, Low-Low and outliers, 999 permutations, seed 57
11. Count every SA2 with a tweet and a 'pattern' appears: I = 0.135, p = 0.001
12. Back to 30 tweets and zoom to Melbourne, where most analysed SA2s are
13. The caveats: areas, not people; boundaries change answers; small areas are suppressed

*Setup:* Default settings. Bootstrap: 2,000 paired resamples, seed 57. Moran's I and LISA: 999 permutations, seed 57, 6 nearest neighbours, SA2s with at least 30 tweets unless stated.

#### 3. Ask the data (`/ask` → `/ai-log` → `/records`)

The optional bring-your-own-key feature: the AI settings dialog, a question answered by a mocked model (no real key is used), the generated SQL passing the site's validator, the rows and chart, the human decision, then the audit log and the same rows in the open records.

<img src="docs/showcase/ask-the-data.gif" alt="Ask the data walkthrough" width="960">

1. Ask the data: optional AI with your own key; the rest of the site needs none
2. AI settings: Anthropic by default, the key stays in this tab and goes only to the provider
3. For this demo: a placeholder, not a real key; provider calls are intercepted *(mocked AI response for illustration)*
4. Ask an example question: the five Victorian suburbs with the most crime tweets
5. Step 1: the model writes one SQL query, labelled AI-generated *(mocked AI response for illustration)*
6. Step 2: the site's validator allows one read-only SELECT and runs it
7. Step 3: the explanation cites rows, and every citation is checked *(mocked AI response for illustration)*
8. The rows themselves, with an automatic chart
9. A person decides: accept or reject, and the decision is recorded *(mocked AI response for illustration)*
10. The AI audit log: question, model, SQL, verdict, latency and decision; JSON or CSV *(mocked AI response for illustration)*
11. Records: Melbourne (SAL 21640) in the open table shows the same 4,026 crime tweets

*Setup:* A placeholder key, never a real one. Every request to the provider is intercepted in the browser and answered by a mock grounded in the rows the site returned; the SQL runs for real on the read-only database.

## Overview

In Semester 1 2023, Assignment 2 of **COMP90024 Cluster and Cloud Computing** asked teams to build a cloud-based system on the Melbourne Research Cloud (MRC) that harvests social media, stores it in a distributed database, analyses it at scale and tells stories about life in Australia by comparing online talk with data from the Spatial Urban Data Observatory (SUDO), all deployed automatically.

**Team 57** built *Social Sense*:

- **MPI processors** (mpi4py) streamed a 57 GB Twitter corpus, extracted tweets with regular expressions, scored each with NLTK (tokenise, WordNet-lemmatise, VADER, then a 1-9 scale) and matched its place name to a 2021 ABS suburb.
- **Harvesters** pulled 40 new toots every ten minutes from mastodon.social, mastodon.au and tictoc.social.
- A **three-node CouchDB cluster** stored the posts; **MapReduce views** summarised scores by suburb for all tweets and for posts mentioning income or crime keywords.
- A **Flask API** joined the views with SUDO income (ABS, by SA2) and crime (Victoria Police, by LGA) data and served gzipped Plotly figures to a **React** dashboard.
- **Ansible + Docker Swarm** created the instances, volumes, the cluster and the services.

The two research scenarios were: (1) do people in higher- and lower-income areas talk about money differently, and (2) does the tone of crime talk follow where crime is recorded?

### The revival (2026)

The MRC project, CouchDB cluster and Twitter corpus are gone, and the original dashboard downloaded 37-46 MB of Plotly JSON per map. The revival keeps the methods and conclusions and rebuilds the presentation:

- **Reproducible data pipeline.** `scripts/` re-runs the team's own Python on the surviving inputs (CouchDB view exports, SUDO extracts, ABS boundaries, one week of raw toots), asserts 18 parity checks against the figures the 2023 dashboard shipped, and writes a 1.7 MB read-only SQLite database plus 1.2 MB of simplified TopoJSON.
- **The NLP pipeline in the browser.** NLTK 3.8.1's Punkt sentence splitter, word tokeniser, WordNet noun lemmatiser and VADER, plus the BeautifulSoup HTML-to-text step of the Mastodon harvester, are ported to TypeScript and reproduce the original Python **exactly**: on 127 synthetic tweets and 23 synthetic toots in CI, and on 44,156 real toots locally (0 mismatches in text, tokens, normalised text, VADER scores and buckets). The lab scores a post either the tweet way (mentions, hashtags and links stripped, then geocoded) or the toot way (HTML to text only), as the 2023 code did.
- **Testable claims.** Suburb tweets are pooled into SA2s and LGAs so the scenarios can be measured, with Pearson, Spearman and least-squares fits recomputed in the browser and unit-tested against scipy.

### The 2026 upgrade: how sure, and who checks the AI?

The upgrade adds the questions a statistician would ask of the 2023 results, and a governed way to query the data in plain English. It adds analysis around the original results; it does not change them.

- **Uncertainty everywhere it matters.** Every area average now carries its tweet count and a t-based 95% interval (recovered exactly from the CouchDB `_stats` sums of squares). The scenario relationships get Spearman's rho with a paired percentile bootstrap (2,000 resamples, seed 57), an OLS slope with HC3 robust standard errors and a residual Moran's I. Statistical helpers live in [`web/src/lib/stats/`](web/src/lib/stats) and are tested against scipy, statsmodels and PySAL values computed by [`scripts/verify_stats.py`](scripts/verify_stats.py).
- **Spatial statistics** ([/spatial](https://comp90024-social-sense.vercel.app/spatial)). Global Moran's I with analytic moments and a permutation p-value, a LISA cluster map (High-High, Low-Low and the two outlier types) on the MapLibre choropleth with optional false-discovery-rate control, 6-nearest-neighbour or shared-border weights (rook contiguity read from the TopoJSON arcs, identical to libpysal's), and a sensitivity table across thresholds, weights and area units.
- **Small-area reliability.** Areas whose average rests on fewer than 30 tweets are suppressed from the spatial statistics and flagged on the scenario pages ([DR-003](docs/decisions/DR-003-small-area-suppression.md)). Ecological-fallacy and MAUP caveats sit on the scenario pages, `/spatial` and `/methods`.
- **Ask the data, bring your own key** ([/ask](https://comp90024-social-sense.vercel.app/ask)). The visitor's own model writes one SQL query; this site validates it and runs it read-only; the model explains the rows and must cite them. Every output is labelled AI-generated, every question (both of its model calls) is logged in the visitor's browser, and a person accepts, edits or rejects the answer ([DR-004](docs/decisions/DR-004-byok-text-to-sql.md)).
- **A text-to-SQL evaluation harness** ([/ask/eval](https://comp90024-social-sense.vercel.app/ask/eval)). Sixteen questions with hand-written gold SQL (two deliberately unanswerable), execution accuracy and refusal rate with Wilson 95% intervals, the blocked-SQL rate, latency and tokens, repeated runs, and paired comparison of two models with an exact McNemar test and a Tango score interval for the accuracy difference (checked against R's PropCIs). Malformed or truncated replies count as wrong. No scores are published: the project has no AI budget and does not report results it ran itself.
- **Methods, model card and decision records** under [/methods](https://comp90024-social-sense.vercel.app/methods): uncertainty methods, assumptions, an AI use statement, what I'd change, a [model card](docs/model-card.md) and four [decision records](docs/decisions).

### Key results (recomputed)

| Finding | Number |
| --- | --- |
| Geotagged tweets matched to a suburb (Feb-Jul 2022) | 2,418,617 (719,336 in Victoria) |
| Tweets scored a neutral 5 | 48% |
| Victorian SA2s after the team's outlier rule; median income range | 420; $28,996 (Merbein) to $62,029 (Sydenham) |
| Income vs tone of income tweets across SA2s | Pearson r = 0.14 (p = 0.07, 167 SA2s): no meaningful link |
| Crime tweets scored 1 (extremely negative) | 25%, the most common score |
| Suburbs with more crime talk sound gloomier? | r = -0.05 (p = 0.63, 102 suburbs): no |
| mastodon.social toots scored neutral | 79% in 2023; 61% in a re-scored May 2023 week (non-English toots fall to neutral) |
| Is tone clustered in space? (SA2s with at least 30 tweets) | Moran's I = 0.02, permutation p = 0.24, 152 SA2s: no. Counting every SA2 with a tweet gives 0.14 (p = 0.001), which is small-area noise |
| Income vs tone of income tweets, with uncertainty | Spearman's rho = 0.10, 95% bootstrap interval -0.06 to 0.26 (167 SA2s): consistent with no association |

## Pages

| Route | What it shows |
| --- | --- |
| `/` | The story: the question, a scroll-driven diagram of the original architecture, recomputed findings, credits |
| `/twitter` | Suburb sentiment map (all, income and crime tweets) with rankings |
| `/income` | Scenario 1: SA2 income choropleth linked to a scatter, regression and live correlations |
| `/crime` | Scenario 2: LGA offences vs crime-tweet sentiment, with the outliers toggle and the suburb-level check |
| `/mastodon` | The three servers' 2023 histograms, a re-scored week (hourly, by language) and the English-only caveat |
| `/pipeline` | Type a tweet or a toot and watch the ported 2023 code path score it, step by step (Web Worker) |
| `/spatial` | Global and local Moran's I, LISA cluster map, small-area suppression, scenario relationships with bootstrap and robust intervals, sensitivity table |
| `/ask` | Ask the data: bring-your-own-key text-to-SQL with server-side validation, cited answers and a human decision; also a no-key SQL box |
| `/ask/eval` | Text-to-SQL benchmark: 16 questions with gold SQL, Wilson intervals, refusals, paired McNemar comparison, CSV/JSON export |
| `/ai-log` | The AI audit log kept in your browser, with JSON and CSV export |
| `/methods` | Sources, processing, reproduction checks, uncertainty methods, spatial caveats, limitations and assumptions, AI use statement, model card summary, decision records, what I'd change |
| `/methods/model-card` | Model card for the sentiment scorer and the text-to-SQL assistant |
| `/methods/decisions/DR-00N-…` | The four decision records, rendered from `docs/decisions/` |
| `/records` | Every table of `analytics.db` with search, sorting, pagination and CSV export |
| `/tour` | Guided tour: three captioned walkthrough videos with transcripts, and every key screenshot in a lightbox |
| `POST /api/sql` | Validates and runs one read-only SELECT; accepts only `{ "sql": "..." }` |

## Tech stack

| | 2023 original | 2026 revival |
| --- | --- | --- |
| Compute | Melbourne Research Cloud (OpenStack), 6 instances | Static pages and serverless functions on Vercel |
| Storage | CouchDB 3.2.1 cluster (3 nodes) | SQLite `analytics.db`, read-only via `@libsql/client` |
| Processing | Python, mpi4py, CouchDB MapReduce | `uv` scripts (PEP 723) re-running the original code |
| Backend | Flask + Gunicorn | Next.js 16 Server Components and Route Handlers |
| Frontend | React 18, MUI, Plotly, Tailwind | Next.js App Router, React 19, Tailwind CSS v4, shadcn/ui, hand-rolled SVG charts |
| Maps | Plotly Mapbox | MapLibre GL JS + OpenFreeMap tiles (no key), bundled state outlines as fallback |
| NLP | NLTK 3.8.1 (Python 3.11) | The same algorithms in TypeScript, run in a Web Worker |
| Statistics | scipy in notebooks | `web/src/lib/stats` (bootstrap, Wilson, OLS with HC3, Moran's I, LISA), verified against scipy, statsmodels and PySAL |
| AI | A ChatGPT pop-up with a build-time key (never shipped) | Optional, bring your own key: Anthropic or OpenAI from the browser, SQL validated server-side (node-sql-parser + read-only SQLite), audit log in IndexedDB |
| Tests | – | Vitest (479 tests incl. parity with Python), Playwright guided tour (end-to-end journeys), ESLint, TypeScript strict, GitHub Actions |
| Deployment | Ansible + Docker Swarm | `git push` |

## Repository structure

```
.
├── README.md
├── LICENSE
├── .github/workflows/ci.yml     lint, typecheck, test and build the web app
├── docs/                        model card and decision records (mirrored into web/content/ for the site)
│   ├── model-card.md
│   ├── decisions/DR-001 … DR-004
│   └── showcase/                README screenshots (PNG) and walkthrough GIFs, made by `pnpm showcase`
├── coursework/                  the original 2023 submission, moved with git mv (see coursework/README.md)
│   ├── 1_Flask_Backend/         Flask API + Mastodon harvester
│   ├── 2_ReactJS_frontend/      React dashboard and the Plotly JSON it shipped (parity reference)
│   ├── 3_CouchDB_database/      CouchDB cluster set-up
│   ├── 4_Python_data_processing/  MPI processor, NLP, geocoding, MapReduce views, notebooks
│   ├── 5_Ansible_IT_Automation/ Ansible roles and playbooks for MRC + Docker Swarm
│   ├── Report.pdf               team report
│   └── _archive/                the README as submitted
├── scripts/                     reproducible artefact builders (uv), see scripts/README.md
│   ├── build_nlp_assets.py      NLTK resources + NLP parity fixtures
│   ├── build_mastodon.py        re-score the surviving raw toots (aggregates only)
│   ├── build_analytics.py       analytics.db, TopoJSON, parity fixtures, 18 assertions
│   ├── verify_stats.py          scipy / statsmodels / PySAL reference values for the TypeScript statistics
│   ├── verify_paired_diff.R     R PropCIs reference values for the paired-difference interval
│   ├── derived/                 committed intermediate aggregates
│   └── fixtures/                synthetic NLP test corpora (tweets and toot HTML)
└── web/                         the deployable Next.js app (Vercel root)
    ├── data/analytics.db        read-only SQLite (aggregates only)
    ├── public/geo/              simplified ABS boundaries (TopoJSON)
    ├── public/showcase/         /tour media: H.264 walkthroughs, WebVTT captions, posters, WebP screenshots
    ├── e2e/                     Playwright guided tour (showcase.spec.ts), caption overlay, mocked AI provider
    ├── scripts/                 showcase runner and media post-processing (ffmpeg, sharp)
    ├── public/data/nlp/         VADER lexicon, WordNet nouns, Punkt parameters, SAL lookup, HTML entities
    ├── assets/fonts/            Newsreader + Public Sans subsets for the Open Graph image (SIL OFL)
    ├── content/                 mirror of docs/ rendered on /methods (node tools/sync-docs.mjs)
    ├── tools/                   build helpers (MapLibre worker copy, docs sync)
    ├── .env.example             optional variables (none required)
    └── src/
        ├── app/                 routes (/, /twitter, /income, /crime, /mastodon, /spatial, /pipeline, /ask,
        │                        /ask/eval, /ai-log, /methods, /records, /tour) and api/sql
        ├── components/          ui/ (shadcn), layout/, charts/, map/, scenario/, spatial/, ask/, ai/, landing/,
        │                        pipeline/, editorial/
        ├── lib/                 framework-free code + tests: nlp/ (Punkt, tokeniser, WordNet, VADER, pipeline),
        │                        stats/ (correlation, bootstrap, Wilson, OLS/HC3, Moran/LISA, reliability),
        │                        ai/ (provider adapters, key storage, audit log, eval), sql/ (schema docs, benchmark,
        │                        scorer), spatial-analysis.ts, pandas.ts, aggregate.ts, palette.ts
        ├── server/              server-only: analytics.ts, records.ts, spatial.ts, content.ts, geo.ts, db.ts,
        │                        sql/ (guard.ts validator, execute.ts read-only runner)
        ├── hooks/               element size, theme, reduced motion, pipeline worker
        └── workers/             pipeline.worker.ts
```

## Local development

Requirements: Node 20.9+ (tested on Node 26) and pnpm 10.

```bash
cd web
pnpm install
pnpm dev                 # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm start               # serve the production build
```

### Re-recording the showcase

```bash
cd web
pnpm showcase                                   # tour against production; writes docs/showcase/ and public/showcase/
pnpm build && BASE_URL=http://localhost:3000 pnpm showcase   # against a local production build
pnpm showcase:test                              # the same journeys as fast end-to-end tests, no video
```

It uses the system Google Chrome (Playwright `channel: "chrome"`; no browser is downloaded) and the `ffmpeg` on `PATH`. Raw output goes to `web/.showcase/` (git-ignored); `scripts/showcase-media.mjs` encodes the MP4s (H.264, CRF 28, faststart), the README GIFs (960 px, palette per GIF) and the optimised screenshots.

No environment variables are required (see [`web/.env.example`](web/.env.example)). Open Graph image URLs are made absolute from `NEXT_PUBLIC_SITE_URL` if set, otherwise from Vercel's `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`, which Vercel provides at build time, and only fall back to `http://localhost:3000` for local builds.

## Viewing the records

The site is read-only: there are no accounts and nothing is ever written, so it needs no hosted database. Every number it shows comes from one bundled SQLite file, `web/data/analytics.db` (aggregates only), which you can inspect three ways:

- **On the site:** [/records](https://comp90024-social-sense.vercel.app/records) lists every table with row counts; each table page has search, sorting, pagination and a CSV export (no login needed, nothing personal is stored).
- **Locally:** open `web/data/analytics.db` in any SQLite browser (DB Browser for SQLite, TablePlus, `sqlite3 web/data/analytics.db ".tables"`).
- **From source:** rebuild it with `scripts/build_analytics.py` (below); the build asserts parity with the 2023 outputs before writing.

On Vercel the file ships with the serverless functions (`outputFileTracingIncludes`) and is copied to `/tmp` on a cold start; it is never written to.

## Bring your own key: how the AI features work

The site works fully without AI. The optional features (`/ask`, `/ask/eval`) use **your** API key, and nothing about them costs the project anything:

- **Where the key lives.** Open *AI settings* (the key icon in the header), pick Anthropic (default: Claude Haiku 4.5, or Sonnet 5.5) or OpenAI (any model id your key can use), and paste your key. It is kept in `sessionStorage` (this tab only) unless you tick *Remember on this device* (`localStorage`). *Forget key* removes it from both.
- **Where the key goes.** Only to the provider, directly from your browser (Anthropic's `anthropic-dangerous-direct-browser-access` header; OpenAI's CORS-enabled API). It is never sent to this site: `POST /api/sql` accepts only `{ "sql": "..." }` and refuses any request that carries an API key header or another field. A `connect-src` Content Security Policy limits where the page can send requests to this site, the two providers and the map tiles. The key is never written to the audit log (it is redacted before every write).
- **What the model may do.** Write one SQL query (structured output, validated with zod) and explain the returned rows with citations. The server's validator (`web/src/server/sql/guard.ts`) allows a single SELECT on documented tables, columns and functions, and the runner executes it on a fresh `query_only` SQLite connection, wrapped with a 200-row cap and a 2.5 s interrupt.
- **Governance.** Every output is labelled AI-generated; you see the SQL, the validator's verdict, the rows and an automatic chart; you can edit the SQL and re-run it; and you record a decision (accepted, edited, rejected). The design is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency obligations and the NIST AI RMF; it does not claim compliance with any of them. See the AI use statement on [/methods](https://comp90024-social-sense.vercel.app/methods#ai-use) and [DR-004](docs/decisions/DR-004-byok-text-to-sql.md).

### Viewing the AI audit log

Every AI call made from your browser is recorded in IndexedDB (database `social-sense-ai`, store `audit_log`): id, timestamp, feature, provider, model, question, generated and edited SQL, validator verdict and issues, row count, answer and cited rows, latency, token usage reported by the provider, and the human decision. Open [/ai-log](https://comp90024-social-sense.vercel.app/ai-log) to browse it, filter by feature, and export it as JSON or CSV. There is no server-side copy: the site has no accounts, so clearing site data deletes the log.

## Methods, model card and decision records

- [/methods](https://comp90024-social-sense.vercel.app/methods): data provenance, the 2023 and 2026 processing, reproduction checks, how uncertainty is reported and verified, spatial caveats (ecological fallacy, MAUP), limitations and assumptions, the AI use statement and what I'd change.
- [`docs/model-card.md`](docs/model-card.md): the VADER sentiment scorer (reproduction checks, a measured language failure mode with Wilson intervals) and the text-to-SQL assistant.
- [`docs/decisions/`](docs/decisions): DR-001 rebuilding from the team's code with the Plotly figures as the answer key; DR-002 read-only SQLite on serverless (and containing model-written SQL); DR-003 the small-area suppression threshold; DR-004 replacing the 2023 client-side ChatGPT pop-up with bring-your-own-key text-to-SQL. Each states the decision, the options, the reasons, what happened (weak numbers included) and what I'd change. Records are superseded, never rewritten.

`docs/` is canonical; `node web/tools/sync-docs.mjs` mirrors it into `web/content/` for the site, and a test fails if the two differ.

## How the data artefacts are generated

Everything the site reads is committed, so the app builds without the raw data. To regenerate it you need [uv](https://docs.astral.sh/uv/), Node (for `npx mapshaper`) and the raw inputs, which are not in the repository because they are licensed (the University's Twitter corpus and its CouchDB views), personal (harvested toots) or large (ABS boundaries). Point `scripts/raw` at them and run:

```bash
ln -s "/path/to/COMP90024/Assignment 2" scripts/raw   # ignored by git
uv run scripts/build_nlp_assets.py                    # NLTK assets + NLP parity fixtures
uv run scripts/build_mastodon.py                      # optional; output already committed
uv run scripts/build_analytics.py                     # analytics.db + TopoJSON + parity fixtures
uv run scripts/verify_stats.py                        # reference statistics (scipy, statsmodels, PySAL); needs no raw data
Rscript scripts/verify_paired_diff.R                  # paired-difference interval reference (needs R package PropCIs)
cd web && pnpm test
```

The builds are deterministic and stop with `PARITY FAILURE` if a result no longer matches the 2023 outputs. Details, inputs and licences: [`scripts/README.md`](scripts/README.md).

## Credits

**Team 57**, COMP90024 Cluster and Cloud Computing, The University of Melbourne, Semester 1 2023:

| Name | Role |
| --- | --- |
| Sunchuangyu (Rin) Huang | Frontend lead; data processing and API tools |
| Xuan Wang | CouchDB cluster; Ansible automation |
| Wei Zhao | Flask backend; Ansible automation |
| Zongchao Xie | Scenario analysis; data processing |
| Runqiu Fei | Data processing; database |

The 2026 revival (this web app, the scripts and the TypeScript ports) was built by Sunchuangyu Huang.

Data and tools: Twitter corpus provided by the University via the Australian Data Observatory (only aggregates are published); public Mastodon timelines; SUDO / ABS personal income and jobs data and Crime Statistics Agency Victoria offence data; ABS ASGS boundaries (CC BY 4.0); OpenFreeMap tiles and OpenStreetMap data; VADER (Hutto & Gilbert, 2014, MIT), WordNet 3.0 and NLTK (Apache 2.0). Base CouchDB set-up from the FEIT COMP90024 materials; Twitter processing adapted from the author's COMP90024 Assignment 1.

## Academic integrity

The original submission is preserved in [`coursework/`](coursework) for reference, including the team's own report. The revival re-runs the team's code and does not change its methods or conclusions. The assignment specification and the course-provided raw datasets are not published in this repository or on the website. Please do not submit any part of this work as your own.

## License

[MIT](LICENSE)
