/**
 * Port of NLTK 3.8.1 `nltk.word_tokenize` = Punkt sentence splitting followed
 * by `NLTKWordTokenizer.tokenize` (nltk/tokenize/destructive.py) on every
 * sentence. Regular expressions are translated rule by rule; see ./pyre.ts for
 * the Python-compatible character classes.
 */
import type { PunktSentenceTokenizer } from "./punkt";
import { B, D, END, S, W, pySplit } from "./pyre";

type Rule = [RegExp, string];

const re = (src: string, flags = "gu") => new RegExp(src, flags);

const STARTING_QUOTES: Rule[] = [
  [re(String.raw`([«“‘„]|\x60+)`), " $1 "],
  [re(String.raw`^"`), "\x60\x60"],
  [re(String.raw`(\x60\x60)`), " $1 "],
  [re(String.raw`([ (\[{<])("|'{2})`), "$1 \x60\x60 "],
  [re(String.raw`(')(?!re|ve|ll|m|t|s|d|n)(${W})${B}`, "giu"), "$1 $2"],
];

const ENDING_QUOTES: Rule[] = [
  [re(String.raw`([»”’])`), " $1 "],
  [re(String.raw`''`), " '' "],
  [re(String.raw`"`), " '' "],
  [re(String.raw`([^' ])('[sS]|'[mM]|'[dD]|') `), "$1 $2 "],
  [re(String.raw`([^' ])('ll|'LL|'re|'RE|'ve|'VE|n't|N'T) `), "$1 $2 "],
];

const PUNCTUATION: Rule[] = [
  [re(String.raw`([^.])(\.)([\])}>"'»”’ ]*)${S}*${END}`), "$1 $2 $3 "],
  [re(String.raw`([:,])([^${D}])`), " $1 $2"],
  [re(String.raw`([:,])${END}`), " $1 "],
  [re(String.raw`\.{2,}`), " $& "],
  [re(String.raw`[;@#$%&]`), " $& "],
  [re(String.raw`([^.])(\.)([\])}>"']*)${S}*${END}`), "$1 $2$3 "],
  [re(String.raw`[?!]`), " $& "],
  [re(String.raw`([^'])' `), "$1 ' "],
  [re(String.raw`[*]`), " $& "],
];

const PARENS_BRACKETS: Rule = [re(String.raw`[\][(){}<>]`), " $& "];
const DOUBLE_DASHES: Rule = [re(String.raw`--`), " -- "];

const CONTRACTIONS2: RegExp[] = [
  String.raw`${B}(can)(not)${B}`,
  String.raw`${B}(d)('ye)${B}`,
  String.raw`${B}(gim)(me)${B}`,
  String.raw`${B}(gon)(na)${B}`,
  String.raw`${B}(got)(ta)${B}`,
  String.raw`${B}(lem)(me)${B}`,
  String.raw`${B}(more)('n)${B}`,
  String.raw`${B}(wan)(na)(?=${S})`,
].map((s) => re(s, "giu"));

const CONTRACTIONS3: RegExp[] = [String.raw` ('t)(is)${B}`, String.raw` ('t)(was)${B}`].map((s) =>
  re(s, "giu"),
);

/** `NLTKWordTokenizer().tokenize(text)` for a single sentence. */
export function nltkWordTokenizer(input: string): string[] {
  let text = input;
  for (const [r, sub] of STARTING_QUOTES) text = text.replace(r, sub);
  for (const [r, sub] of PUNCTUATION) text = text.replace(r, sub);
  text = text.replace(PARENS_BRACKETS[0], PARENS_BRACKETS[1]);
  text = text.replace(DOUBLE_DASHES[0], DOUBLE_DASHES[1]);
  text = ` ${text} `;
  for (const [r, sub] of ENDING_QUOTES) text = text.replace(r, sub);
  for (const r of CONTRACTIONS2) text = text.replace(r, " $1 $2 ");
  for (const r of CONTRACTIONS3) text = text.replace(r, " $1 $2 ");
  return pySplit(text);
}

/** `nltk.word_tokenize(text)` (language="english", preserve_line=False). */
export function wordTokenize(text: string, punkt: PunktSentenceTokenizer): string[] {
  return punkt.tokenize(text).flatMap((sentence) => nltkWordTokenizer(sentence));
}
