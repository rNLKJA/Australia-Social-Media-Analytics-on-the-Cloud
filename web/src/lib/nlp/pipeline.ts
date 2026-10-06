/**
 * The Team 57 tweet/toot pipeline (2023), ported to TypeScript.
 *
 *   html -> text       coursework/1_Flask_Backend/harvester/mastodon/toot.py (toots only)
 *   clean_content      coursework/4_Python_data_processing/scripts/twitter/processor.py (tweets only)
 *   normalize_string   .../scripts/sentimental_analysis/analyzer.py
 *   sentiment_analysis .../scripts/sentimental_analysis/analyzer.py
 *   keyword views      .../scripts/MapReduce/{Income/mapIncome.js,Crime/mapCrimeV2.js}
 *   SAL geocoding      .../scripts/twitter/{processor.py,utils.py}
 */
import { htmlToText } from "./html-text";
import { WordNetLemmatizer } from "./lemmatizer";
import { PunktSentenceTokenizer } from "./punkt";
import { NS, S, W } from "./pyre";
import { SentimentIntensityAnalyzer, type PolarityScores } from "./vader";
import { wordTokenize } from "./word-tokenize";
import { sentimentBucket, sentimentDescription, type SentimentBucket } from "../sentiment";

export interface NlpEngine {
  punkt: PunktSentenceTokenizer;
  lemmatizer: WordNetLemmatizer;
  sia: SentimentIntensityAnalyzer;
  salLookup: Record<string, string>;
  /** BeautifulSoup's named-entity table (name without ";" -> text) */
  htmlEntities: Record<string, string>;
}

const MENTION = new RegExp(`@${W}+${S}*`, "gu");
const HASHTAG = new RegExp(`#${W}+${S}*`, "gu");
const URL = new RegExp(String.raw`https?:\/\/${NS}+`, "gu");

/** processor.py: strip @mentions, #hashtags and links before scoring. */
export function cleanContent(content: string): string {
  return content.replace(MENTION, "").replace(HASHTAG, "").replace(URL, "");
}

/** analyzer.py `normalize_string`: word_tokenize + WordNet lemmatise + join. */
export function normalizeString(engine: NlpEngine, input: string): string {
  return tokensAndLemmas(engine, input).lemmas.join(" ");
}

export function tokensAndLemmas(
  engine: NlpEngine,
  input: string,
): { sentences: string[]; tokens: string[]; lemmas: string[] } {
  const sentences = engine.punkt.tokenize(input);
  const tokens = wordTokenize(input, engine.punkt);
  const lemmas = tokens.map((t) => engine.lemmatizer.lemmatize(t));
  return { sentences, tokens, lemmas };
}

import { CRIME_WORDS, INCOME_WORDS } from "./keywords";

export { CRIME_WORDS, INCOME_WORDS };

/** `content.toLowerCase().includes(word)`; returns the first matching keyword. */
export function keywordHit(content: string, words: readonly string[]): string | null {
  const lowered = content.toLowerCase();
  for (const w of words) if (lowered.includes(w)) return w;
  return null;
}

// ---- SAL geocoding (twitter/utils.py) ------------------------------------

const GCCS = ["Canberra", "Sydney", "Darwin", "Brisbane", "Adelaide", "Hobart", "Melbourne", "Perth"];
const STATE_LOCATION: [string, string][] = [
  ["australian capital territory", "act"],
  ["new south wales", "nsw"],
  ["northern territory", "nt"],
  ["queensland", "qld"],
  ["south australia", "sa"],
  ["tasmania", "tas"],
  ["victoria", "vic"],
  ["western australia", "wa"],
];
const NON_WORD_SPACE = new RegExp(`[^\\p{L}\\p{N}_${S.slice(1, -1)}]`, "gu");

/** utils.py `normalise_location` (called with an already-lowercased string). */
export function normaliseLocation(location: string): string {
  let text = location.replace(NON_WORD_SPACE, "");
  text = text.replaceAll(" - ", "");
  const head = location.split(",")[0];
  if (GCCS.includes(head)) text = head.toLowerCase();
  for (const [key, value] of STATE_LOCATION) text = text.replaceAll(key, value);
  return text.replace(/ +/g, " ");
}

/** utils.py `return_words_ngrams`: every order-preserving combination. */
export function wordsNgrams(words: string[]): string[] {
  const out: string[] = [];
  const n = words.length;
  const combo = (size: number) => {
    const idx = Array.from({ length: size }, (_, k) => k);
    for (;;) {
      out.push(idx.map((k) => words[k]).join(" "));
      let k = size - 1;
      while (k >= 0 && idx[k] === n - size + k) k--;
      if (k < 0) return;
      idx[k]++;
      for (let j = k + 1; j < size; j++) idx[j] = idx[j - 1] + 1;
    }
  };
  for (let size = 1; size <= n; size++) combo(size);
  return out;
}

export interface GeocodeResult {
  normalised: string;
  ngrams: number;
  matched: string | null;
  sal: string | null;
  /** true when the place string was too long to enumerate (UI guard, not in the original) */
  skipped: boolean;
}

/**
 * The SAL matching block of `twitter_processor_v1`: try every n-gram of the
 * normalised place name in order and keep the first that is a SAL key. The
 * original also called `sal_dict.get(normalise_location)` with the function
 * object itself, which never matches, so it is omitted. `maxWords` guards the
 * 2^n enumeration in the browser; Twitter place names are 2-4 words.
 */
export function geocodePlace(
  salLookup: Record<string, string>,
  fullName: string,
  maxWords = 14,
): GeocodeResult {
  const normalised = normaliseLocation(fullName.toLowerCase());
  const words = normalised.split(" ");
  if (words.length > maxWords) return { normalised, ngrams: 0, matched: null, sal: null, skipped: true };
  const ngrams = wordsNgrams(words);
  for (const g of ngrams) {
    if (Object.prototype.hasOwnProperty.call(salLookup, g) && salLookup[g]) {
      return { normalised, ngrams: ngrams.length, matched: g, sal: salLookup[g], skipped: false };
    }
  }
  return { normalised, ngrams: ngrams.length, matched: null, sal: null, skipped: false };
}

// ---- end-to-end ------------------------------------------------------------

/** Which 2023 code path scored the post. */
export type PostSource = "twitter" | "mastodon";

export interface PipelineTrace {
  source: PostSource;
  input: string;
  /** after step 1: tweets with mentions/hashtags/links stripped; toots converted from HTML */
  cleaned: string;
  sentences: string[];
  tokens: string[];
  lemmas: string[];
  normalized: string;
  scores: PolarityScores;
  bucket: SentimentBucket;
  description: string;
  income: string | null;
  crime: string | null;
}

/**
 * Score one post exactly as the 2023 code did. Tweets (twitter/processor.py)
 * had mentions, hashtags and links stripped; toots (harvester/mastodon/toot.py)
 * were only converted from HTML to text, so hashtags and mentions were scored.
 */
export function scorePost(engine: NlpEngine, input: string, source: PostSource = "twitter"): PipelineTrace {
  const cleaned = source === "twitter" ? cleanContent(input) : htmlToText(input, engine.htmlEntities);
  const { sentences, tokens, lemmas } = tokensAndLemmas(engine, cleaned);
  const normalized = lemmas.join(" ");
  const scores = engine.sia.polarityScores(normalized);
  const bucket = sentimentBucket(scores.compound);
  return {
    source,
    input,
    cleaned,
    sentences,
    tokens,
    lemmas,
    normalized,
    scores,
    bucket,
    description: sentimentDescription(bucket),
    income: keywordHit(normalized, INCOME_WORDS),
    crime: keywordHit(normalized, CRIME_WORDS),
  };
}
