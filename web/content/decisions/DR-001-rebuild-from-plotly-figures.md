# DR-001: Rebuild the analysis from the team's code and use the shipped Plotly figures as the answer key

- **Status:** accepted
- **Decided:** October 2026, during the revival (recorded on 6 October 2026)
- **Scope:** `scripts/build_analytics.py`, `web/data/analytics.db`, `web/public/geo/`

## Context

The 2023 system is gone. The Melbourne Research Cloud project, the three-node CouchDB cluster and the 57 GB Twitter corpus no longer exist. What survives is the team's code in `coursework/`, exports of the three CouchDB MapReduce views (per-suburb `_stats` of 1-9 sentiment scores), the SUDO income and crime extracts, ABS boundaries, one week of raw Mastodon toots, and the gzipped Plotly figure JSON the React dashboard downloaded (37 to 46 MB per map). The revival had to decide what the website's numbers would be built from.

## Decision

Re-run the team's own processing functions, imported unchanged from `coursework/`, on the surviving intermediate inputs, and treat the shipped Plotly figures as the answer key rather than the data source. The build script writes a small read-only SQLite database only after it reproduces what the 2023 dashboard showed; a mismatch stops the build with `PARITY FAILURE`.

## Options considered

1. **Serve the Plotly JSON as it was.** Fastest to ship and trivially faithful, but 37 to 46 MB per map, no way to join datasets, and only the rounded values the charts displayed.
2. **Extract the numbers from the Plotly JSON into a database.** Smaller, but the figures carry rounded averages, not counts and sums, so suburbs could not be pooled into SA2s or LGAs and no uncertainty could be computed.
3. **Recompute from the raw tweets.** The faithful option in principle, but impossible: the corpus is gone.
4. **Re-run the team's code on the surviving view exports and check it against the Plotly figures.** Chosen.

## Why

Option 4 keeps the methods and conclusions the team's own, because the same functions run on the same inputs, while producing the raw ingredients the figures never had: counts, score sums and sums of squares per suburb. Those ingredients made the revival's suburb-to-SA2 and suburb-to-LGA pooling possible, and the 2026 upgrade's per-area confidence intervals, small-area suppression (DR-003) and spatial statistics all depend on the sum of squares from the CouchDB `_stats` reduce. The Plotly JSON is still used, as an independent check that the rebuilt numbers are the ones people saw in 2023.

## What happened

- The build asserts 18 parity checks. Every count and rounded average on the 1,085-suburb Twitter map reproduces (all 6,510 values), as do the 420 SA2s and 72 LGAs left by the team's outlier rule, the income range (Merbein $28,996 to Sydenham $62,029), and every bar of the original crime chart.
- Two numbers are close rather than exact, and the site says so: the saved CouchDB view holds 2,418,617 geotagged tweets against the report's 2,418,621, and the surviving week of mastodon.social toots scores 61% neutral where the 2023 histogram showed 79% (a different week, and non-English toots fall to neutral).
- The pooling of suburbs into SA2s and LGAs is new. In 2023 the comparison between tweets and official statistics was visual only, so the correlations on the scenario pages are a revival analysis, labelled as such.
- The geocoder's quirks are reproduced on purpose. Its shortest-match rule sends "St Kilda, Victoria" to St Kilda in South Australia, so St Kilda and Albert Park are missing from the map. Fixing that would change the team's results, so the methods page documents it instead.
- The parity checks only cover what the dashboard displayed. Anything the 2023 dashboard never showed, such as sums of squares, has no answer key and rests on the view exports alone.

## What I'd change

- Record a hash of every raw input in the database's `meta` table, so a reader can tell exactly which files produced a given build.
- Publish the parity report itself as a table, with the expected and reproduced value for each check, rather than a summary on the methods page.
- Add a small property-based test that pools random suburb sums and checks the SA2 and LGA totals add up, independent of the specific data.
