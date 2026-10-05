/**
 * Port of NLTK 3.8.1 `nltk.sentiment.vader.SentimentIntensityAnalyzer`
 * (nltk/sentiment/vader.py), including its quirks (for example, repeated
 * words reuse the index of their first occurrence). VADER: Hutto & Gilbert,
 * ICWSM 2014.
 */
import { pyIsUpper, pyLen, pyRound, pySplit } from "./pyre";

const B_INCR = 0.293;
const B_DECR = -0.293;
const C_INCR = 0.733;
const N_SCALAR = -0.74;

const NEGATE = new Set([
  "aint", "arent", "cannot", "cant", "couldnt", "darent", "didnt", "doesnt",
  "ain't", "aren't", "can't", "couldn't", "daren't", "didn't", "doesn't",
  "dont", "hadnt", "hasnt", "havent", "isnt", "mightnt", "mustnt", "neither",
  "don't", "hadn't", "hasn't", "haven't", "isn't", "mightn't", "mustn't",
  "neednt", "needn't", "never", "none", "nope", "nor", "not", "nothing",
  "nowhere", "oughtnt", "shant", "shouldnt", "uhuh", "wasnt", "werent",
  "oughtn't", "shan't", "shouldn't", "uh-uh", "wasn't", "weren't", "without",
  "wont", "wouldnt", "won't", "wouldn't", "rarely", "seldom", "despite",
]);

const BOOSTER_DICT = new Map<string, number>([
  ...[
    "absolutely", "amazingly", "awfully", "completely", "considerably", "decidedly",
    "deeply", "effing", "enormously", "entirely", "especially", "exceptionally",
    "extremely", "fabulously", "flipping", "flippin", "fricking", "frickin",
    "frigging", "friggin", "fully", "fucking", "greatly", "hella", "highly",
    "hugely", "incredibly", "intensely", "majorly", "more", "most", "particularly",
    "purely", "quite", "really", "remarkably", "so", "substantially", "thoroughly",
    "totally", "tremendously", "uber", "unbelievably", "unusually", "utterly", "very",
  ].map((w) => [w, B_INCR] as [string, number]),
  ...[
    "almost", "barely", "hardly", "just enough", "kind of", "kinda", "kindof",
    "kind-of", "less", "little", "marginally", "occasionally", "partly", "scarcely",
    "slightly", "somewhat", "sort of", "sorta", "sortof", "sort-of",
  ].map((w) => [w, B_DECR] as [string, number]),
]);

const SPECIAL_CASE_IDIOMS = new Map<string, number>([
  ["the shit", 3],
  ["the bomb", 3],
  ["bad ass", 1.5],
  ["yeah right", -2],
  ["cut the mustard", 2],
  ["kiss of death", -1.5],
  ["hand to mouth", -2],
]);

/** Python `string.punctuation`. */
const ASCII_PUNCT = new Set("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");
const REMOVE_PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;

const PUNC_LIST = new Set([
  ".", "!", "?", ",", ";", ":", "-", "'", '"', "!!", "!!!", "??", "???", "?!?",
  "!?!", "?!?!", "!?!?",
]);

export interface PolarityScores {
  neg: number;
  neu: number;
  pos: number;
  compound: number;
}

function negated(word: string): boolean {
  const w = word.toLowerCase();
  if (NEGATE.has(w)) return true;
  if (w.includes("n't")) return true;
  return false; // pairwise "least" check never fires for a single word
}

function normalize(score: number, alpha = 15): number {
  return score / Math.sqrt(score * score + alpha);
}

function scalarIncDec(word: string, valence: number, isCapDiff: boolean): number {
  let scalar = 0.0;
  const lower = word.toLowerCase();
  const b = BOOSTER_DICT.get(lower);
  if (b !== undefined) {
    scalar = b;
    if (valence < 0) scalar *= -1;
    if (pyIsUpper(word) && isCapDiff) {
      if (valence > 0) scalar += C_INCR;
      else scalar -= C_INCR;
    }
  }
  return scalar;
}

/** SentiText: words and emoticons with leading/trailing punctuation removed. */
export function wordsAndEmoticons(text: string): string[] {
  const noPunc = text.replace(REMOVE_PUNCT, "");
  const wordsOnly = new Set(pySplit(noPunc).filter((w) => pyLen(w) > 1));
  const wes = pySplit(text).filter((we) => pyLen(we) > 1);
  return wes.map((we) => {
    // leading run of ASCII punctuation
    let a = 0;
    while (a < we.length && ASCII_PUNCT.has(we[a])) a++;
    if (a > 0) {
      const lead = we.slice(0, a);
      const rest = we.slice(a);
      if (PUNC_LIST.has(lead) && wordsOnly.has(rest)) return rest;
    }
    let z = we.length;
    while (z > 0 && ASCII_PUNCT.has(we[z - 1])) z--;
    if (z < we.length) {
      const trail = we.slice(z);
      const rest = we.slice(0, z);
      if (PUNC_LIST.has(trail) && wordsOnly.has(rest)) return rest;
    }
    return we;
  });
}

function allcapDifferential(words: string[]): boolean {
  let allcap = 0;
  for (const w of words) if (pyIsUpper(w)) allcap++;
  const diff = words.length - allcap;
  return diff > 0 && diff < words.length;
}

export class SentimentIntensityAnalyzer {
  private readonly lexicon: Map<string, number>;

  constructor(lexicon: Record<string, number> | Map<string, number>) {
    this.lexicon = lexicon instanceof Map ? lexicon : new Map(Object.entries(lexicon));
  }

  polarityScores(text: string): PolarityScores {
    const words = wordsAndEmoticons(text);
    const isCapDiff = allcapDifferential(words);
    let sentiments: number[] = [];
    for (const item of words) {
      const valence = 0;
      const i = words.indexOf(item);
      const lower = item.toLowerCase();
      if (
        (i < words.length - 1 && lower === "kind" && words[i + 1].toLowerCase() === "of") ||
        BOOSTER_DICT.has(lower)
      ) {
        sentiments.push(valence);
        continue;
      }
      sentiments = this.sentimentValence(valence, words, isCapDiff, item, i, sentiments);
    }
    sentiments = this.butCheck(words, sentiments);
    return this.scoreValence(sentiments, text);
  }

  private notInLexicon(w: string): boolean {
    return !this.lexicon.has(w.toLowerCase());
  }

  private sentimentValence(
    valenceIn: number,
    words: string[],
    isCapDiff: boolean,
    item: string,
    i: number,
    sentiments: number[],
  ): number[] {
    let valence = valenceIn;
    const lex = this.lexicon.get(item.toLowerCase());
    if (lex !== undefined) {
      valence = lex;
      if (pyIsUpper(item) && isCapDiff) {
        if (valence > 0) valence += C_INCR;
        else valence -= C_INCR;
      }
      for (let startI = 0; startI < 3; startI++) {
        if (i > startI && this.notInLexicon(words[i - (startI + 1)])) {
          let s = scalarIncDec(words[i - (startI + 1)], valence, isCapDiff);
          if (startI === 1 && s !== 0) s = s * 0.95;
          if (startI === 2 && s !== 0) s = s * 0.9;
          valence = valence + s;
          valence = this.neverCheck(valence, words, startI, i);
          if (startI === 2) valence = this.idiomsCheck(valence, words, i);
        }
      }
      valence = this.leastCheck(valence, words, i);
    }
    sentiments.push(valence);
    return sentiments;
  }

  private leastCheck(valence: number, words: string[], i: number): number {
    if (i > 1 && this.notInLexicon(words[i - 1]) && words[i - 1].toLowerCase() === "least") {
      if (words[i - 2].toLowerCase() !== "at" && words[i - 2].toLowerCase() !== "very") {
        return valence * N_SCALAR;
      }
    } else if (
      i > 0 &&
      this.notInLexicon(words[i - 1]) &&
      words[i - 1].toLowerCase() === "least"
    ) {
      return valence * N_SCALAR;
    }
    return valence;
  }

  private butCheck(wordsIn: string[], sentiments: number[]): number[] {
    const words = wordsIn.map((w) => w.toLowerCase());
    const bi = words.indexOf("but");
    if (bi >= 0) {
      for (let sidx = 0; sidx < sentiments.length; sidx++) {
        if (sidx < bi) sentiments[sidx] = sentiments[sidx] * 0.5;
        else if (sidx > bi) sentiments[sidx] = sentiments[sidx] * 1.5;
      }
    }
    return sentiments;
  }

  private idiomsCheck(valenceIn: number, w: string[], i: number): number {
    let valence = valenceIn;
    const onezero = `${w[i - 1]} ${w[i]}`;
    const twoonezero = `${w[i - 2]} ${w[i - 1]} ${w[i]}`;
    const twoone = `${w[i - 2]} ${w[i - 1]}`;
    const threetwoone = `${w[i - 3]} ${w[i - 2]} ${w[i - 1]}`;
    const threetwo = `${w[i - 3]} ${w[i - 2]}`;
    for (const seq of [onezero, twoonezero, twoone, threetwoone, threetwo]) {
      const v = SPECIAL_CASE_IDIOMS.get(seq);
      if (v !== undefined) {
        valence = v;
        break;
      }
    }
    if (w.length - 1 > i) {
      const v = SPECIAL_CASE_IDIOMS.get(`${w[i]} ${w[i + 1]}`);
      if (v !== undefined) valence = v;
    }
    if (w.length - 1 > i + 1) {
      const v = SPECIAL_CASE_IDIOMS.get(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
      if (v !== undefined) valence = v;
    }
    if (BOOSTER_DICT.has(threetwo) || BOOSTER_DICT.has(twoone)) valence = valence + B_DECR;
    return valence;
  }

  private neverCheck(valenceIn: number, w: string[], startI: number, i: number): number {
    let valence = valenceIn;
    if (startI === 0) {
      if (negated(w[i - 1])) valence = valence * N_SCALAR;
    }
    if (startI === 1) {
      if (w[i - 2] === "never" && (w[i - 1] === "so" || w[i - 1] === "this")) {
        valence = valence * 1.5;
      } else if (negated(w[i - (startI + 1)])) {
        valence = valence * N_SCALAR;
      }
    }
    if (startI === 2) {
      if (
        (w[i - 3] === "never" && (w[i - 2] === "so" || w[i - 2] === "this")) ||
        w[i - 1] === "so" ||
        w[i - 1] === "this"
      ) {
        valence = valence * 1.25;
      } else if (negated(w[i - (startI + 1)])) {
        valence = valence * N_SCALAR;
      }
    }
    return valence;
  }

  private scoreValence(sentiments: number[], text: string): PolarityScores {
    let compound = 0.0;
    let pos = 0.0;
    let neg = 0.0;
    let neu = 0.0;
    if (sentiments.length) {
      // CPython 3.11 `sum()` adds left to right (no compensated summation).
      let sumS = 0;
      for (const s of sentiments) sumS += s;
      const amp = amplifyEp(text) + amplifyQm(text);
      if (sumS > 0) sumS += amp;
      else if (sumS < 0) sumS -= amp;
      compound = normalize(sumS);

      let posSum = 0.0;
      let negSum = 0.0;
      let neuCount = 0;
      for (const s of sentiments) {
        if (s > 0) posSum += s + 1;
        if (s < 0) negSum += s - 1;
        if (s === 0) neuCount += 1;
      }
      if (posSum > Math.abs(negSum)) posSum += amp;
      else if (posSum < Math.abs(negSum)) negSum -= amp;
      const total = posSum + Math.abs(negSum) + neuCount;
      pos = Math.abs(posSum / total);
      neg = Math.abs(negSum / total);
      neu = Math.abs(neuCount / total);
    }
    return {
      neg: pyRound(neg, 3),
      neu: pyRound(neu, 3),
      pos: pyRound(pos, 3),
      compound: pyRound(compound, 4),
    };
  }
}

function countChar(text: string, ch: string): number {
  let n = 0;
  for (let i = text.indexOf(ch); i !== -1; i = text.indexOf(ch, i + 1)) n++;
  return n;
}

function amplifyEp(text: string): number {
  const ep = Math.min(countChar(text, "!"), 4);
  return ep * 0.292;
}

function amplifyQm(text: string): number {
  const qm = countChar(text, "?");
  if (qm > 1) return qm <= 3 ? qm * 0.18 : 0.96;
  return 0;
}
