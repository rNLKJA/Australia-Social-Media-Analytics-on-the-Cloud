/**
 * The guided tour: recorded walkthroughs and key-feature screenshots.
 *
 * One source of truth for the step captions. The Playwright tour
 * (e2e/showcase.spec.ts) shows them as on-screen captions and writes them to
 * WebVTT files, the /tour page lists them under each video, and the README's
 * "Workflow walkthrough" repeats them (src/lib/showcase.test.ts keeps the
 * three in step). Media are produced by `pnpm showcase`.
 */

export type WalkthroughId = "the-story" | "income-vs-sentiment" | "ask-the-data";

export interface Walkthrough {
  id: WalkthroughId;
  title: string;
  /** Routes the walkthrough visits, in order. */
  routes: readonly string[];
  summary: string;
  /** Seeds and settings, so the recording can be reproduced by hand. */
  setup: string;
  /** On-screen captions, in order (step k is shown as "k/N"). */
  steps: readonly string[];
  /** Step numbers (1-based) whose caption shows the "mocked AI response" badge. */
  mockedSteps?: readonly number[];
}

export const MOCK_LABEL = "Mocked AI response for illustration";

/** Opens every mocked model reply, so the text itself says what it is. */
export const MOCK_PREFIX = "Mocked response for illustration.";

/** The example question the tour asks (one of the suggestion chips on /ask). */
export const TOUR_QUESTION = "Which five Victorian suburbs had the most crime-related tweets?";

export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: "the-story",
    title: "The story",
    routes: ["/"],
    summary:
      "The landing page from top to bottom: the question, Victoria's geotagged tweets drawn as suburb dots, the 2023 brief, the original cloud system animated step by step as you scroll, the four recomputed findings and the 2026 upgrade.",
    setup: "No input needed: every number is recovered from the 2023 outputs or recomputed by scripts/.",
    steps: [
      "The question: does the mood online match life on the ground?",
      "Every dot is a Victorian suburb: size is tweet volume, colour is average tone",
      "The 2023 brief: harvest, store, analyse and compare with official data, on 8 vCPUs",
      "How it worked: scroll to follow a tweet through the original cloud system",
      "Harvest: MPI ranks split the 57 GB file; harvesters poll three Mastodon servers",
      "Score and store: VADER on a 1-9 scale, bulk-loaded into a three-node CouchDB cluster",
      "Summarise: MapReduce views keep a count, sum, min and max for every suburb",
      "Serve and compare: a Flask API joins the views with SUDO income and crime data",
      "Automate: Ansible and Docker Swarm on the Melbourne Research Cloud",
      "Four findings, recomputed from the recovered numbers",
      "The 2026 upgrade: intervals, spatial statistics and an optional, audited AI",
    ],
  },
  {
    id: "income-vs-sentiment",
    title: "Income vs sentiment",
    routes: ["/income", "/spatial"],
    summary:
      "Scenario 1 end to end: the SA2 income choropleth linked to a scatter of tweet sentiment, the map recoloured by mood, a selected area with its interval, the correlation recomputed live at higher thresholds, the bootstrap interval, then Moran's I and the LISA cluster map on /spatial, and the caveats that come with them.",
    setup:
      "Default settings. Bootstrap: 2,000 paired resamples, seed 57. Moran's I and LISA: 999 permutations, seed 57, 6 nearest neighbours, SA2s with at least 30 tweets unless stated.",
    steps: [
      "Scenario 1: do richer areas tweet more happily about money?",
      "The choropleth: median personal income for 420 Victorian SA2s (ABS, 2015-16)",
      "The linked scatter: one dot per SA2, sized by its income tweets",
      "Recolour the map by the mood of income tweets instead",
      "Select Ballarat: the map, the chart and the detail panel follow, with a 95% interval",
      "Raise the tweet threshold: the correlation is recomputed in the browser",
      "How sure? Spearman's rho 0.10, bootstrap 95% CI -0.06 to 0.26, which includes zero",
      "Spatial statistics: is the mood clustered in space, or is it noise?",
      "Global Moran's I = 0.022, permutation p = 0.24 across 152 SA2s: no evidence of clustering",
      "The LISA cluster map: High-High, Low-Low and outliers, 999 permutations, seed 57",
      "Count every SA2 with a tweet and a 'pattern' appears: I = 0.135, p = 0.001",
      "Back to 30 tweets and zoom to Melbourne, where most analysed SA2s are",
      "The caveats: areas, not people; boundaries change answers; small areas are suppressed",
    ],
  },
  {
    id: "ask-the-data",
    title: "Ask the data",
    routes: ["/ask", "/ai-log", "/records"],
    summary:
      "The optional bring-your-own-key feature: the AI settings dialog, a question answered by a mocked model (no real key is used), the generated SQL passing the site's validator, the rows and chart, the human decision, then the audit log and the same rows in the open records.",
    setup:
      "A placeholder key, never a real one. Every request to the provider is intercepted in the browser and answered by a mock grounded in the rows the site returned; the SQL runs for real on the read-only database.",
    steps: [
      "Ask the data: optional AI with your own key; the rest of the site needs none",
      "AI settings: Anthropic by default, the key stays in this tab and goes only to the provider",
      "For this demo: a placeholder, not a real key; provider calls are intercepted",
      "Ask an example question: the five Victorian suburbs with the most crime tweets",
      "Step 1: the model writes one SQL query, labelled AI-generated",
      "Step 2: the site's validator allows one read-only SELECT and runs it",
      "Step 3: the explanation cites rows, and every citation is checked",
      "The rows themselves, with an automatic chart",
      "A person decides: accept or reject, and the decision is recorded",
      "The AI audit log: question, model, SQL, verdict, latency and decision; JSON or CSV",
      "Records: Melbourne (SAL 21640) in the open table shows the same 4,026 crime tweets",
    ],
    mockedSteps: [3, 5, 7, 9, 10],
  },
];

export interface Screenshot {
  /** File name without extension, e.g. "01-landing-light". */
  id: string;
  title: string;
  caption: string;
  viewport: "desktop" | "mobile";
}

export const SCREENSHOTS: readonly Screenshot[] = [
  {
    id: "01-landing-light",
    title: "Landing page",
    caption: "The question, and Victoria's geotagged tweets drawn as one dot per suburb.",
    viewport: "desktop",
  },
  {
    id: "02-landing-dark",
    title: "Landing page, dark mode",
    caption: "The same hero in dark mode.",
    viewport: "desktop",
  },
  {
    id: "03-architecture",
    title: "The original cloud system",
    caption: "A scroll-driven diagram of the 2023 MPI, CouchDB, Flask and React system.",
    viewport: "desktop",
  },
  {
    id: "04-sentiment-map",
    title: "Suburb sentiment map",
    caption: "Average tone of geotagged tweets per suburb, by topic, with a tweet threshold.",
    viewport: "desktop",
  },
  {
    id: "05-income-explorer",
    title: "Scenario 1: income",
    caption: "SA2 income choropleth linked to a sentiment scatter; the correlation is recomputed live.",
    viewport: "desktop",
  },
  {
    id: "06-income-uncertainty",
    title: "How sure can we be?",
    caption: "Spearman's rho with a bootstrap interval, HC3 slope and residual Moran's I.",
    viewport: "desktop",
  },
  {
    id: "07-crime-explorer",
    title: "Scenario 2: crime",
    caption: "Recorded offences by LGA against the tone of crime tweets.",
    viewport: "desktop",
  },
  {
    id: "08-spatial-lisa",
    title: "Spatial statistics",
    caption: "Global Moran's I with a permutation test and the LISA cluster map.",
    viewport: "desktop",
  },
  {
    id: "09-mastodon",
    title: "Mastodon: VADER only speaks English",
    caption: "Neutral share and mean score by language, with intervals, from a re-scored week of toots.",
    viewport: "desktop",
  },
  {
    id: "10-pipeline",
    title: "The 2023 pipeline in your browser",
    caption: "The ported NLTK and VADER code path scores a post step by step.",
    viewport: "desktop",
  },
  {
    id: "11-ai-settings",
    title: "Bring your own key",
    caption: "AI settings: Anthropic by default; the key stays in this browser.",
    viewport: "desktop",
  },
  {
    id: "12-ask-mocked-answer",
    title: "Ask the data (mocked reply)",
    caption: "Validated SQL, cited rows and a human decision. The model reply is mocked.",
    viewport: "desktop",
  },
  {
    id: "13-ask-eval",
    title: "Text-to-SQL benchmark",
    caption: "16 questions with hand-written gold SQL, run on your own key; nothing is pre-scored.",
    viewport: "desktop",
  },
  {
    id: "14-ai-log",
    title: "AI audit log",
    caption: "Every AI call from this browser, with the human decision; JSON and CSV export.",
    viewport: "desktop",
  },
  {
    id: "15-methods",
    title: "Data and methods",
    caption: "How uncertainty is reported and how the statistics are checked against Python.",
    viewport: "desktop",
  },
  {
    id: "16-records",
    title: "Records",
    caption: "Every table of the read-only database, searchable and exportable as CSV.",
    viewport: "desktop",
  },
  {
    id: "17-mobile-landing",
    title: "Mobile: landing",
    caption: "The landing page on a 390 px phone.",
    viewport: "mobile",
  },
  {
    id: "18-mobile-income",
    title: "Mobile: Scenario 1",
    caption: "The income scatter and correlations on a phone.",
    viewport: "mobile",
  },
  {
    id: "19-mobile-spatial",
    title: "Mobile: spatial statistics",
    caption: "Moran's I and the LISA map on a phone.",
    viewport: "mobile",
  },
];

/** Public paths of a walkthrough's media (files live in web/public/showcase/). */
export function walkthroughMedia(id: WalkthroughId) {
  return {
    mp4: `/showcase/${id}.mp4`,
    poster: `/showcase/${id}-poster.webp`,
    captions: `/showcase/${id}.vtt`,
  };
}

/** Public path of a screenshot's WebP copy used by /tour. */
export const screenshotSrc = (id: string) => `/showcase/screens/${id}.webp`;

/** Pixel size of the WebP copies (desktop 1440 × 900; mobile 390 × 844 at 1.5×). */
export const SCREENSHOT_SIZE = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 585, height: 1266 },
} as const;
