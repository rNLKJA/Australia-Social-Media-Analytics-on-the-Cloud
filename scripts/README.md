# scripts/

Reproducible Python scripts that turn the **original** Team 57 code and data into the small, aggregate-only artefacts the web app ships. Each script declares its own dependencies inline ([PEP 723](https://peps.python.org/pep-0723/)), so `uv run` creates an isolated environment. No script writes tweet or toot text, author names, ids or URLs into the repository.

| Script | Reads | Writes | Runtime |
| --- | --- | --- | --- |
| `build_nlp_assets.py` | NLTK 3.8.1 data (downloaded to `scripts/.cache/`), `coursework/.../sal.processed.dict.pkl`, `fixtures/nlp_parity_corpus.txt` | `web/public/data/nlp/*` (VADER lexicon, WordNet noun lemmas, Punkt English parameters, SAL lookup), `web/src/lib/__fixtures__/nlp-parity.json` | ~5 s |
| `build_mastodon.py` | raw mastodon.social harvest (`raw/Mastodon_social/*.json`, 595k toots) | `derived/mastodon-social-2023-05.json` (hourly, language and histogram aggregates) | ~1 min on 9 cores |
| `build_analytics.py` | Plotly JSON shipped by the 2023 dashboard (`coursework/2_ReactJS_frontend/frontend/public`), CouchDB view exports, SUDO CSVs, ABS boundaries, `derived/*.json` | `web/data/analytics.db`, `web/public/geo/*.topo.json`, `web/src/lib/__fixtures__/*-parity.json` | ~30 s |

Run them in this order (later steps consume earlier outputs):

```bash
uv run scripts/build_nlp_assets.py           # Python 3.11, the version the team's Docker images used
uv run scripts/build_mastodon.py             # optional: needs the raw toots; output is committed
uv run scripts/build_analytics.py            # needs Node (npx mapshaper) for the boundary files
```

All outputs are deterministic: re-running a script on the same inputs produces byte-identical files.

## Parity checks

The scripts call the original functions from `coursework/` (imported unchanged) and stop with `PARITY FAILURE` if a result does not reproduce what the 2023 dashboard or report showed. `build_analytics.py` currently asserts 18 checks, including:

- the CouchDB view totals equal the original Twitter histogram total (2,418,617 geotagged tweets);
- every count and rounded average on the original 1,085-SAL Twitter map;
- 457 Victorian SA2s with income data, 420 after the team's IQR filter, Merbein (28,996 AUD) lowest and Sydenham (62,029 AUD) highest (report section 6.2.1);
- 79 LGAs with crime data, exactly the 72 drawn on the original crime map after filtering, and every category total of the original grouped bar chart;
- the SUDO summary quotes (8ACTE median 60.2k, 5RWAU mean 71.5k).

`build_nlp_assets.py` records the outputs of the original `normalize_string` / `sentiment_analysis` / SAL geocoder on a synthetic corpus so the TypeScript port can be tested in CI (`web/src/lib/nlp/nlp.test.ts`). With `--sample N` it also scores N real toots into `/tmp` for a local-only cross-check (never committed, because it contains public toot text). At the time of writing the port reproduced all 44,156 toots of one harvest file exactly.

## Raw inputs (not in the repository)

The raw inputs are licensed (the University-provided Twitter corpus and its CouchDB views), personal (harvested toots), or simply large (ABS boundaries, SUDO extracts). They live with the author's course archive; point the scripts at them with a symlink or `--raw`:

```bash
ln -s "/path/to/COMP90024/Drive/Assignment 2" scripts/raw    # ignored by git
```

Expected layout under `scripts/raw/`:

```
twitter/sentimentLocation.json, incomeMentioned.json, crimeMentioned.json   CouchDB `_stats` view exports (per SAL)
twitter/SAL_2021_AUST_GDA94_SHP/                                             ABS SAL 2021 boundaries
sudo/personal_income.csv, sudo/crime.csv                                     SUDO extracts (ABS personal income by SA2, VIC CSA offences by LGA)
sudo/sa2_2016_aust_shape/, sudo/lga_2019_aust_shp/, sudo/GCCSA_2021_AUST_SHP_GDA2020/   ABS boundaries
Mastodon_social/Mastodon_social_*.json                                       raw mastodon.social API responses (May 2023)
```

ABS boundary files are © Australian Bureau of Statistics, CC BY 4.0. The VADER lexicon is MIT-licensed; WordNet 3.0 is distributed under the WordNet licence; Punkt parameters come from NLTK (Apache 2.0).
