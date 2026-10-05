import { WordNetLemmatizer, decodeFrontCoded } from "./lemmatizer";
import type { NlpEngine } from "./pipeline";
import { PunktSentenceTokenizer, loadPunktParams, type PunktParamsJson } from "./punkt";
import { SentimentIntensityAnalyzer } from "./vader";

/** Static assets written by scripts/build_nlp_assets.py into public/data/nlp/. */
export const NLP_ASSETS = {
  vader: "vader-lexicon.json",
  nouns: "wordnet-nouns.fc.txt",
  exceptions: "wordnet-noun-exceptions.json",
  punkt: "punkt-english.json",
  sal: "sal-lookup.json",
} as const;

export interface NlpAssetPayload {
  vader: Record<string, number>;
  nounsFrontCoded: string;
  exceptions: Record<string, string[]>;
  punkt: PunktParamsJson;
  sal: Record<string, string>;
}

export function createEngine(a: NlpAssetPayload): NlpEngine {
  return {
    punkt: new PunktSentenceTokenizer(loadPunktParams(a.punkt)),
    lemmatizer: new WordNetLemmatizer(decodeFrontCoded(a.nounsFrontCoded), a.exceptions),
    sia: new SentimentIntensityAnalyzer(a.vader),
    salLookup: a.sal,
  };
}

/** Fetch every asset from a base URL (browser / worker). */
export async function fetchEngine(base = "/data/nlp/"): Promise<NlpEngine> {
  const get = (f: string) =>
    fetch(base + f).then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${f} (${r.status})`);
      return r;
    });
  const [vader, nounsFrontCoded, exceptions, punkt, sal] = await Promise.all([
    get(NLP_ASSETS.vader).then((r) => r.json()),
    get(NLP_ASSETS.nouns).then((r) => r.text()),
    get(NLP_ASSETS.exceptions).then((r) => r.json()),
    get(NLP_ASSETS.punkt).then((r) => r.json()),
    get(NLP_ASSETS.sal).then((r) => r.json()),
  ]);
  return createEngine({ vader, nounsFrontCoded, exceptions, punkt, sal });
}
