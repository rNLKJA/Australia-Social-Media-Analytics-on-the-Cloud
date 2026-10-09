# Model card: the sentiment scorer and the "Ask the data" assistant

Social Sense uses two models. The first is the 2023 team's sentiment pipeline, which produced every sentiment number on the site. The second is optional: a third-party language model, chosen and paid for by the visitor, that turns questions into SQL. This card covers both, following the usual model-card headings: what each is for, what it was built from, how it was evaluated, how it fails and what to keep in mind.

## 1. The sentiment scorer (2023, reproduced in 2026)

### Model details

- A rule-based lexicon model: VADER (Hutto and Gilbert, 2014) as shipped in NLTK 3.8.1, wrapped in the team's pipeline. Tweets have mentions, hashtags and links stripped, are split into sentences and words with NLTK's Punkt and word tokeniser, have nouns lemmatised with WordNet, and are scored by VADER. Toots are only converted from HTML to text first.
- VADER's compound score (-1 to 1) is mapped onto the team's 1-9 scale: 1 for -0.8 or below, 5 (neutral) for scores strictly between -0.2 and 0.2, 9 for 0.8 or above, in steps of 0.2.
- The revival ports the whole pipeline to TypeScript so it runs in the browser on the `/pipeline` page.

### Intended use

Describing the aggregate tone of public, geotagged posts by area and topic for a coursework question: does online mood track income or recorded crime? It is not suitable for judging individual posts or people, for decisions about places or communities, or for anything other than English text.

### Training data and provenance

The team trained nothing. VADER's lexicon of roughly 7,500 words, emoticons and slang terms was rated for valence by human raters, as described by its authors. The scored data are the University-provided Twitter corpus (February to July 2022, accessed through the Australian Data Observatory) and public Mastodon timelines (mastodon.social, mastodon.au, tictoc.social). Only aggregates are stored on this site: no post text, ids or user names.

### Evaluation

- **Reproduction, not accuracy.** The TypeScript port reproduces the original Python exactly on 127 synthetic tweets and 23 synthetic toots in CI, and on 44,156 real toots locally: 0 mismatches in text, tokens, normalised text, all four VADER scores and the bucket. With 0 mismatches in 44,156 the Wilson 95% upper bound on the mismatch rate is 0.009%.
- **Accuracy against human judgement was not measured here.** The project has no labelled sample of its own posts, so no accuracy figure is claimed. VADER's authors report strong agreement with human raters on social media text; that is their evaluation, on their data.
- **A measured failure mode: language.** In the re-scored week of mastodon.social toots (2-9 May 2023), the share scored exactly neutral depends heavily on the declared language, because the lexicon is English (Wilson 95% intervals):

  | Declared language | Toots | Scored neutral (5) |
  | --- | ---: | --- |
  | English (en) | 339,498 | 45.2% [45.1, 45.4] |
  | Undetermined (und) | 58,130 | 86.2% [86.0, 86.5] |
  | Japanese (ja) | 49,412 | 98.3% [98.1, 98.4] |
  | German (de) | 42,888 | 57.5% [57.0, 58.0] |
  | Chinese (zh) | 20,523 | 96.1% [95.8, 96.3] |
  | French (fr) | 18,920 | 75.4% [74.8, 76.1] |
  | Spanish (es) | 17,293 | 71.2% [70.6, 71.9] |
  | Dutch (nl) | 10,892 | 72.1% [71.2, 72.9] |

  German sits closer to English than other languages for the wrong reason: English lexicon words such as "die" also occur in German, where they mean something else.

### Known failure modes

- Non-English text falls to neutral or is mis-scored (above).
- Sarcasm, irony, negation across sentences and new slang are scored on the words, not the meaning.
- Neutral is the most common score (48% of geotagged tweets), so area averages cluster near 5 and differences between areas are small relative to the spread within them (see the spatial statistics page).
- The location, not the model, is often the weakest link: the geocoder's shortest-match rule places some suburbs in the wrong state, and "Melbourne, Victoria" lands in the CBD.

### Ethical considerations

The posts were public, but their authors did not consent to this analysis, so the site publishes aggregates only. Very small areas can still reflect a handful of people's posts; the spatial statistics suppress averages built on fewer than 30 tweets (DR-003), and no area-level number should be read as a statement about the people who live there (the ecological fallacy).

## 2. The "Ask the data" assistant (2026, optional, bring your own key)

### Model details

A general-purpose large language model chosen by the visitor: Anthropic's Claude Haiku 4.5 by default or Claude Sonnet 5.5, or an OpenAI chat model the visitor names. This project does not train, fine-tune or host it. It is called from the visitor's browser with the visitor's key, twice per question: once to write SQL (structured output: answerable, sql, reason) and once to explain the returned rows (structured output: answer, cited rows, caveat).

### Intended use

Exploratory questions about the public aggregates in `analytics.db`, with every step shown: the SQL, the validator's verdict, the rows and a short explanation that cites them. The answer is a draft to check against the table, not a finding. It is not for questions about individuals, which the data cannot answer anyway.

### Data

The provider receives the question exactly as the visitor typed it, the documented schema (table and column descriptions), the generated SQL and up to 30 result rows. The database holds only public aggregate data, but anything a visitor types into the question is sent as is, so the page asks people not to include personal information. This site receives only the SQL. The key stays in the visitor's browser.

### Evaluation

The `/ask/eval` page runs 16 questions with hand-written gold SQL (14 answerable, 2 that should be refused) on the visitor's model and reports execution accuracy and refusal rates with Wilson 95% intervals, the share of SQL the validator blocked or SQLite rejected, latency (median with a bootstrap interval) and token use, and compares two runs with an exact McNemar test and a Tango score 95% interval for the paired accuracy difference (checked against R's PropCIs). A reply that is malformed, cut off or refused counts as wrong, and its tokens and time are counted; only infrastructure failures (key, quota, rate limit, network, provider outage) are left out of the denominators. **No results are published here.** The project has no AI budget and does not report scores it ran itself. With 14 scored questions an interval is up to about ±25 points wide, so the harness is a smoke test for a broken prompt or a weak model, not a ranking.

### Known failure modes

- Plausible but wrong SQL: the wrong topic, a missing state filter, a fraction returned as a percentage, integer division.
- Hallucinated tables or columns (the validator blocks them) and double quotes around text values (blocked, with a hint).
- Answering what cannot be answered (individual users, periods outside the data) instead of declining, or declining what can be answered.
- Explanations that over-read aggregate data, for example talking about people where the rows describe areas. Citations are checked to exist, not to be true.
- Model ids age; a retired id fails with a clear error rather than silently switching.

### Safeguards

Validator (single SELECT, allow-listed tables, columns and functions, no PRAGMA, ATTACH, writes, recursive CTEs with or without the RECURSIVE keyword, escapes or bind parameters), read-only execution (`query_only`, one statement, 200-row cap, 2.5 s interrupt, 64 MB cap on SQLite's memory), a Content Security Policy that limits where the page can send requests, AI-generated labels on every output, citation checks, a human accept, edit or reject step, and a per-browser audit log with JSON and CSV export (`/ai-log`): one record per question covering its two model calls, a new linked record when edited SQL is re-run, and only the human decision updated after a record is written. See DR-002 and DR-004.

### Ethical considerations

Calls are billed to the visitor and governed by their agreement with the provider, including its data retention. The design is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency obligations and the NIST AI Risk Management Framework; it does not claim compliance with any of them.
