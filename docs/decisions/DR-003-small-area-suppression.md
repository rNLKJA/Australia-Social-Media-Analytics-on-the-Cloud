# DR-003: Suppress area averages built on fewer than 30 tweets from the spatial statistics

- **Status:** accepted
- **Decided:** 6 October 2026
- **Scope:** `/spatial`, the uncertainty panels on `/income` and `/crime`, `MIN_TWEETS_RELIABLE` in `web/src/lib/stats/reliability.ts`

## Context

The scenario pages compare area averages of tweet sentiment with income and crime. Many of those averages rest on almost nothing: the median Victorian SA2 with tweets has 31 of them, a quarter have 7 or fewer, and topic tweets are rarer still (the median SA2 with any income tweet has 5). Individual scores on the 1-9 scale vary with a standard deviation of about 1.74 points, so an average of five tweets can move by more than a point on chance alone. The 2023 analysis used every area with at least one tweet. Adding spatial statistics makes this worse, not better: a Moran's I or a cluster map will happily find "patterns" in noise.

## Decision

On the spatial statistics page, an area whose average rests on fewer than 30 tweets in the chosen measure is suppressed: hatched on the map, left out of Moran's I, the LISA cluster map and the uncertainty panels' main comparison. The threshold is a default, not a hidden filter: readers can move it, and a sensitivity table reports results at 1, 10, 30 and 100 tweets. The scenario explorers keep the team's 2023 defaults so the original results stay as they were, but every area now shows its tweet count and a 95% interval, and areas under 30 tweets are flagged as low reliability.

## Options considered

1. **No threshold (the 2023 behaviour).** Faithful, but it lets single tweets drive the map and the statistics.
2. **A low threshold of 10.** Keeps more of the map, but an average of 10 tweets still has a 95% interval about 2.5 points wide.
3. **30 tweets.** Chosen.
4. **A reliability-based threshold.** Estimating the real between-area spread (about 0.18 points for SA2s) against the within-area spread (1.74) says an SA2 needs about 89 tweets before half of its average's variation is real difference. Principled, but it would keep only about a third of the SA2s with tweets and would move every time the estimate moved.
5. **Shrink instead of suppress** (empirical Bayes or a multilevel model). The better method, and the one I would build next, but it changes every number on the map and is harder to explain next to the team's original figures.

## Why

Thirty is a conventional floor below which a mean's sampling error dominates, it is easy to state on a map legend, and it is in the spirit of official statistical practice of not publishing small-area estimates whose relative standard error is too high (here an absolute interval width plays that role, because the scale is bounded). At 30 tweets the 95% interval on an average is roughly ±0.65 points. It keeps 152 of the 296 SA2s with tweets and 72 of the 79 LGAs. The reliability-based figure of about 89 is shown on the page instead of being used as the cut, so readers can see how much noise remains even above the threshold.

## What happened

- The apparent clustering was mostly small-area noise. Counting every SA2 with a tweet, global Moran's I is 0.135 (permutation p = 0.001, 6 nearest neighbours). At 10 tweets it falls to 0.064 (p = 0.04), at 30 to 0.022 (p = 0.24), and at 100 it is -0.062 (p = 0.15). LGAs tell the same story: 0.136 (p = 0.01) at one tweet, -0.019 (p = 0.49) at 30. The team's 2023 reading, that sentiment "showed no geographic pattern", holds once the noise is controlled; the low-threshold clustering would have contradicted it for the wrong reason.
- The weak numbers stay weak. Even at 30 tweets an SA2 average is only about 25% signal by the variance-components estimate, and the standard errors assume tweets are independent, which prolific accounts break, so the intervals are optimistic.
- One relationship appears only under some thresholds. Median income against the tone of all tweets gives Spearman's rho of 0.22 (95% bootstrap interval 0.08 to 0.36) at 10 tweets and 0.20 (0.04 to 0.36) at 30, but 0.10 (-0.02 to 0.22) at one tweet and 0.15 (-0.06 to 0.34) at 100. It is reported as a fragile, exploratory lead, not a finding, and the team's actual question (income against the tone of income tweets) stays null at every threshold.
- Topic-level spatial analysis is mostly impossible: only 34 SA2s have 30 income tweets and only 4 LGAs have 30 crime tweets. The page says so rather than lowering the bar.

## What I'd change

- Replace the hard cut with partial pooling (an empirical Bayes or multilevel model), so small areas are pulled towards their neighbourhood instead of disappearing.
- Account for clustering by account. The view exports carry no user identifiers (deliberately), so the effective sample size cannot be estimated; a future pipeline should keep a per-area count of distinct accounts.
- Pre-register the threshold and the comparisons before looking, rather than reporting a sensitivity table after the fact.
