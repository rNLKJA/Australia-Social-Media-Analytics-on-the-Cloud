# docs/

Documentation that sits beside the code. Everything here is also rendered on the website under [/methods](https://comp90024-social-sense.vercel.app/methods).

| File | What it is |
| --- | --- |
| [`model-card.md`](model-card.md) | Model card for the 2023 sentiment scorer and the optional "Ask the data" assistant |
| [`decisions/DR-001-rebuild-from-plotly-figures.md`](decisions/DR-001-rebuild-from-plotly-figures.md) | Rebuild the analysis from the team's code; use the shipped Plotly figures as the answer key |
| [`decisions/DR-002-read-only-sqlite-on-serverless.md`](decisions/DR-002-read-only-sqlite-on-serverless.md) | Ship the data as a read-only SQLite file; how model-written SQL is contained |
| [`decisions/DR-003-small-area-suppression.md`](decisions/DR-003-small-area-suppression.md) | Suppress area averages built on fewer than 30 tweets from the spatial statistics |
| [`decisions/DR-004-byok-text-to-sql.md`](decisions/DR-004-byok-text-to-sql.md) | Replace the 2023 ChatGPT pop-up with bring-your-own-key text-to-SQL and server-side validation |

Decision records follow one format: Context; Decision; Options considered; Why; What happened (including the weak numbers); What I'd change. A past record is never edited to change its decision: a new record supersedes it.

The web app cannot read files outside `web/` when it is deployed, so these files are mirrored into `web/content/` by `node web/tools/sync-docs.mjs`. A test fails if the two copies differ.
