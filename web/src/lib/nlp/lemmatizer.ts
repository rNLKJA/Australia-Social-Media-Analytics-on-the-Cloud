/**
 * Port of NLTK 3.8.1 `WordNetLemmatizer().lemmatize(word)` with the default
 * part of speech (noun), i.e. WordNet's `_morphy(word, "n")` followed by
 * `min(lemmas, key=len)`. Source: nltk/stem/wordnet.py and
 * nltk/corpus/reader/wordnet.py.
 */
import { pyLen } from "./pyre";

const NOUN_SUBSTITUTIONS: [string, string][] = [
  ["s", ""],
  ["ses", "s"],
  ["ves", "f"],
  ["xes", "x"],
  ["zes", "z"],
  ["ches", "ch"],
  ["shes", "sh"],
  ["men", "man"],
  ["ies", "y"],
];

/** Decode the front-coded noun list written by scripts/build_nlp_assets.py. */
export function decodeFrontCoded(text: string): Set<string> {
  const out = new Set<string>();
  let prev = "";
  for (const line of text.split("\n")) {
    if (!line) continue;
    const shared = line.charCodeAt(0) - 48;
    const word = prev.slice(0, shared) + line.slice(1);
    out.add(word);
    prev = word;
  }
  return out;
}

export class WordNetLemmatizer {
  constructor(
    private readonly nouns: Set<string>,
    private readonly exceptions: Record<string, string[]>,
  ) {}

  private applyRules(forms: string[]): string[] {
    const out: string[] = [];
    for (const form of forms) {
      for (const [old, repl] of NOUN_SUBSTITUTIONS) {
        if (form.endsWith(old)) out.push(form.slice(0, form.length - old.length) + repl);
      }
    }
    return out;
  }

  private filterForms(forms: string[]): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const form of forms) {
      if (this.nouns.has(form) && !seen.has(form)) {
        result.push(form);
        seen.add(form);
      }
    }
    return result;
  }

  /** `wn._morphy(form, "n")` */
  morphy(form: string): string[] {
    if (Object.prototype.hasOwnProperty.call(this.exceptions, form)) {
      return this.filterForms([form, ...this.exceptions[form]]);
    }
    let forms = this.applyRules([form]);
    let results = this.filterForms([form, ...forms]);
    if (results.length) return results;
    while (forms.length) {
      forms = this.applyRules(forms);
      results = this.filterForms(forms);
      if (results.length) return results;
    }
    return [];
  }

  lemmatize(word: string): string {
    const lemmas = this.morphy(word);
    if (!lemmas.length) return word;
    let best = lemmas[0];
    for (const l of lemmas) if (pyLen(l) < pyLen(best)) best = l;
    return best;
  }
}
