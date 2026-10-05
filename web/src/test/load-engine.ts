import { readFileSync } from "node:fs";
import path from "node:path";
import { NLP_ASSETS, createEngine } from "@/lib/nlp/engine";
import type { NlpEngine } from "@/lib/nlp/pipeline";

const dir = path.resolve(import.meta.dirname, "../../public/data/nlp");
const read = (f: string) => readFileSync(path.join(dir, f), "utf8");

let cached: NlpEngine | null = null;

/** Build the NLP engine from the committed assets (tests only). */
export function loadEngine(): NlpEngine {
  cached ??= createEngine({
    vader: JSON.parse(read(NLP_ASSETS.vader)),
    nounsFrontCoded: read(NLP_ASSETS.nouns),
    exceptions: JSON.parse(read(NLP_ASSETS.exceptions)),
    punkt: JSON.parse(read(NLP_ASSETS.punkt)),
    sal: JSON.parse(read(NLP_ASSETS.sal)),
  });
  return cached;
}
