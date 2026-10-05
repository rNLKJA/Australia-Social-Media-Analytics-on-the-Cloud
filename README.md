<div align="center">

# Social Sense: Australia Social Media Analytics on the Cloud

**Does the mood online match life on the ground?** A University of Melbourne cloud computing project (COMP90024, 2023) that scored 2.4 million geotagged tweets and 1.7 million Mastodon toots for sentiment and set them against official income and crime statistics, revived in 2026 as an interactive, read-only website.

**Live demo:** [comp90024-social-sense.vercel.app](https://comp90024-social-sense.vercel.app)

[![CI](https://github.com/rNLKJA/Australia-Social-Media-Analytics-on-the-Cloud/actions/workflows/ci.yml/badge.svg)](https://github.com/rNLKJA/Australia-Social-Media-Analytics-on-the-Cloud/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

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

## Pages

| Route | What it shows |
| --- | --- |
| `/` | The story: the question, a scroll-driven diagram of the original architecture, recomputed findings, credits |
| `/twitter` | Suburb sentiment map (all, income and crime tweets) with rankings |
| `/income` | Scenario 1: SA2 income choropleth linked to a scatter, regression and live correlations |
| `/crime` | Scenario 2: LGA offences vs crime-tweet sentiment, with the outliers toggle and the suburb-level check |
| `/mastodon` | The three servers' 2023 histograms, a re-scored week (hourly, by language) and the English-only caveat |
| `/pipeline` | Type a tweet or a toot and watch the ported 2023 code path score it, step by step (Web Worker) |
| `/methods` | Sources, original and revival processing, reproduction checks, limitations |
| `/records` | Every table of `analytics.db` with search, sorting, pagination and CSV export |

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
| Tests | – | Vitest (289 tests incl. parity), ESLint, TypeScript strict, GitHub Actions |
| Deployment | Ansible + Docker Swarm | `git push` |

## Repository structure

```
.
├── README.md
├── LICENSE
├── .github/workflows/ci.yml     lint, typecheck, test and build the web app
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
│   ├── derived/                 committed intermediate aggregates
│   └── fixtures/                synthetic NLP test corpora (tweets and toot HTML)
└── web/                         the deployable Next.js app (Vercel root)
    ├── data/analytics.db        read-only SQLite (aggregates only)
    ├── public/geo/              simplified ABS boundaries (TopoJSON)
    ├── public/data/nlp/         VADER lexicon, WordNet nouns, Punkt parameters, SAL lookup, HTML entities
    ├── assets/fonts/            Newsreader + Public Sans subsets for the Open Graph image (SIL OFL)
    ├── tools/                   build helpers (MapLibre worker copy)
    ├── .env.example             optional variables (none required)
    └── src/
        ├── app/                 routes (/, /twitter, /income, /crime, /mastodon, /pipeline, /methods, /records)
        ├── components/          ui/ (shadcn), layout/, charts/, map/, scenario/, landing/, pipeline/, editorial/
        ├── lib/                 framework-free ports + tests: nlp/ (Punkt, tokeniser, WordNet, VADER, pipeline),
        │                        stats.ts (scipy), pandas.ts (rounding, quantiles, IQR filter), aggregate.ts, palette.ts
        ├── server/              read-only data access ("server-only"): analytics.ts, records.ts, geo.ts, db.ts
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

No environment variables are required (see [`web/.env.example`](web/.env.example)). Open Graph image URLs are made absolute from `NEXT_PUBLIC_SITE_URL` if set, otherwise from Vercel's `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`, which Vercel provides at build time, and only fall back to `http://localhost:3000` for local builds.

## Viewing the records

The site is read-only: there are no accounts, no forms and no writes, so it needs no hosted database. Every number it shows comes from one bundled SQLite file, `web/data/analytics.db` (aggregates only), which you can inspect three ways:

- **On the site:** [/records](https://comp90024-social-sense.vercel.app/records) lists every table with row counts; each table page has search, sorting, pagination and a CSV export (no login needed, nothing personal is stored).
- **Locally:** open `web/data/analytics.db` in any SQLite browser (DB Browser for SQLite, TablePlus, `sqlite3 web/data/analytics.db ".tables"`).
- **From source:** rebuild it with `scripts/build_analytics.py` (below); the build asserts parity with the 2023 outputs before writing.

On Vercel the file ships with the serverless functions (`outputFileTracingIncludes`) and is copied to `/tmp` on a cold start; it is never written to.

## How the data artefacts are generated

Everything the site reads is committed, so the app builds without the raw data. To regenerate it you need [uv](https://docs.astral.sh/uv/), Node (for `npx mapshaper`) and the raw inputs, which are not in the repository because they are licensed (the University's Twitter corpus and its CouchDB views), personal (harvested toots) or large (ABS boundaries). Point `scripts/raw` at them and run:

```bash
ln -s "/path/to/COMP90024/Assignment 2" scripts/raw   # ignored by git
uv run scripts/build_nlp_assets.py                    # NLTK assets + NLP parity fixtures
uv run scripts/build_mastodon.py                      # optional; output already committed
uv run scripts/build_analytics.py                     # analytics.db + TopoJSON + parity fixtures
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
