/**
 * Port of NLTK 3.8.1 `PunktSentenceTokenizer.tokenize` (inference only) with
 * the pre-trained English parameters (`tokenizers/punkt/english.pickle`).
 *
 * Source: nltk/tokenize/punkt.py. Training code is not ported; the learned
 * parameters are exported by scripts/build_nlp_assets.py.
 */
import { ALPHA, D, END, NS, S, firstChar, pyIsLower, pyIsUpper, pyRstrip, pyStrip } from "./pyre";

export interface PunktParamsJson {
  abbrevTypes: string[];
  collocations: [string, string][];
  sentStarters: string[];
  orthoContext: Record<string, number>;
}

export interface PunktParams {
  abbrevTypes: Set<string>;
  collocations: Set<string>;
  sentStarters: Set<string>;
  orthoContext: Map<string, number>;
}

export function loadPunktParams(json: PunktParamsJson): PunktParams {
  return {
    abbrevTypes: new Set(json.abbrevTypes),
    collocations: new Set(json.collocations.map(([a, b]) => `${a}\u0000${b}`)),
    sentStarters: new Set(json.sentStarters),
    orthoContext: new Map(Object.entries(json.orthoContext)),
  };
}

// Orthographic context flags
const ORTHO_BEG_UC = 1 << 1;
const ORTHO_MID_UC = 1 << 2;
const ORTHO_UNK_UC = 1 << 3;
const ORTHO_BEG_LC = 1 << 4;
const ORTHO_MID_LC = 1 << 5;
const ORTHO_UNK_LC = 1 << 6;
const ORTHO_UC = ORTHO_BEG_UC + ORTHO_MID_UC + ORTHO_UNK_UC;
const ORTHO_LC = ORTHO_BEG_LC + ORTHO_MID_LC + ORTHO_UNK_LC;

const SENT_END_CHARS = [".", "?", "!"];
const PUNCTUATION = new Set([";", ":", ",", ".", "!", "?"]);

// PunktLanguageVars regexes (English defaults)
const RE_WORD_START = String.raw`[^("\x60{\[:;&#*@)}\]\-,]`;
const RE_NON_WORD_CHARS = String.raw`(?:[)";}\]*:@'({\[?!])`;
const RE_MULTI_CHAR_PUNCT = String.raw`(?:-{2,}|\.{2,}|(?:\.${S}){2,}\.)`;

const WORD_TOKENIZER = new RegExp(
  [
    RE_MULTI_CHAR_PUNCT,
    `(?=${RE_WORD_START})${NS}+?(?=${S}|${END}|${RE_NON_WORD_CHARS}|${RE_MULTI_CHAR_PUNCT}|,(?=${END}|${S}|${RE_NON_WORD_CHARS}|${RE_MULTI_CHAR_PUNCT}))`,
    NS,
  ].join("|"),
  "gu",
);

const PERIOD_CONTEXT = new RegExp(
  String.raw`[\.\?!](?=(?<after_tok>${RE_NON_WORD_CHARS}|${S}+(?<next_tok>${NS}+)))`,
  "gdu",
);

// re_boundary_realignment (MULTILINE): `$` matches before any "\n" or at end.
const RE_BOUNDARY_REALIGNMENT = new RegExp(
  String.raw`^["')\]}]+?(?:${S}+|(?=--)|(?=\n|$))`,
  "u",
);

const RE_ELLIPSIS = /^\.\.+$/u;
const RE_NUMERIC = new RegExp(String.raw`^-?[\.,]?${D}[${D},\.-]*\.?${END}`, "u");
const RE_INITIAL = new RegExp(`^${ALPHA}\\.${END}`, "u");

/** Python's `string.whitespace` (ASCII only). */
const ASCII_WS = new Set([" ", "\t", "\n", "\r", "\x0b", "\x0c"]);

class PunktToken {
  readonly tok: string;
  readonly type: string;
  readonly periodFinal: boolean;
  sentbreak = false;
  abbr = false;
  ellipsis = false;

  constructor(tok: string) {
    this.tok = tok;
    const lower = tok.toLowerCase();
    this.type = RE_NUMERIC.test(lower) ? "##number##" : lower;
    this.periodFinal = tok.endsWith(".");
  }

  get typeNoPeriod(): string {
    if (this.type.length > 1 && this.type.endsWith(".")) return this.type.slice(0, -1);
    return this.type;
  }

  get typeNoSentperiod(): string {
    return this.sentbreak ? this.typeNoPeriod : this.type;
  }

  get firstUpper(): boolean {
    return pyIsUpper(firstChar(this.tok));
  }

  get firstLower(): boolean {
    return pyIsLower(firstChar(this.tok));
  }

  get isEllipsis(): boolean {
    return RE_ELLIPSIS.test(this.tok);
  }

  get isInitial(): boolean {
    return RE_INITIAL.test(this.tok);
  }
}

export class PunktSentenceTokenizer {
  constructor(private readonly params: PunktParams) {}

  /** `sent_tokenize(text)` / `PunktSentenceTokenizer.tokenize(text)`. */
  tokenize(text: string): string[] {
    return this.spanTokenize(text).map(([s, e]) => text.slice(s, e));
  }

  spanTokenize(text: string): [number, number][] {
    const slices = this.realignBoundaries(text, this.slicesFromText(text));
    return slices;
  }

  // --- word tokenisation (PunktLanguageVars.word_tokenize) -------------------

  private tokenizeWords(plaintext: string): PunktToken[] {
    const out: PunktToken[] = [];
    for (const line of plaintext.split("\n")) {
      if (pyStrip(line)) {
        for (const m of line.matchAll(WORD_TOKENIZER)) out.push(new PunktToken(m[0]));
      }
    }
    return out;
  }

  // --- annotation ------------------------------------------------------------

  private firstPassAnnotation(t: PunktToken): void {
    const tok = t.tok;
    if (SENT_END_CHARS.includes(tok)) {
      t.sentbreak = true;
    } else if (t.isEllipsis) {
      t.ellipsis = true;
    } else if (t.periodFinal && !tok.endsWith("..")) {
      const base = tok.slice(0, -1).toLowerCase();
      const parts = base.split("-");
      if (this.params.abbrevTypes.has(base) || this.params.abbrevTypes.has(parts[parts.length - 1])) {
        t.abbr = true;
      } else {
        t.sentbreak = true;
      }
    }
  }

  private orthoHeuristic(t: PunktToken): boolean | "unknown" {
    if (PUNCTUATION.has(t.tok)) return false;
    const ctx = this.params.orthoContext.get(t.typeNoSentperiod) ?? 0;
    if (t.firstUpper && ctx & ORTHO_LC && !(ctx & ORTHO_MID_UC)) return true;
    if (t.firstLower && (ctx & ORTHO_UC || !(ctx & ORTHO_BEG_LC))) return false;
    return "unknown";
  }

  private secondPassAnnotation(t1: PunktToken, t2: PunktToken | null): void {
    if (!t2) return;
    if (!t1.periodFinal) return;
    const typ = t1.typeNoPeriod;
    const nextTyp = t2.typeNoSentperiod;
    const tokIsInitial = t1.isInitial;

    if (this.params.collocations.has(`${typ}\u0000${nextTyp}`)) {
      t1.sentbreak = false;
      t1.abbr = true;
      return;
    }

    if ((t1.abbr || t1.ellipsis) && !tokIsInitial) {
      const isSentStarter = this.orthoHeuristic(t2);
      if (isSentStarter === true) {
        t1.sentbreak = true;
        return;
      }
      if (t2.firstUpper && this.params.sentStarters.has(nextTyp)) {
        t1.sentbreak = true;
        return;
      }
    }

    if (tokIsInitial || typ === "##number##") {
      const isSentStarter = this.orthoHeuristic(t2);
      if (isSentStarter === false) {
        t1.sentbreak = false;
        t1.abbr = true;
        return;
      }
      if (
        isSentStarter === "unknown" &&
        tokIsInitial &&
        t2.firstUpper &&
        !((this.params.orthoContext.get(nextTyp) ?? 0) & ORTHO_LC)
      ) {
        t1.sentbreak = false;
        t1.abbr = true;
      }
    }
  }

  /** `_annotate_tokens`: first pass on every token, second pass pairwise. */
  private annotateTokens(tokens: PunktToken[]): PunktToken[] {
    for (const t of tokens) this.firstPassAnnotation(t);
    for (let i = 0; i < tokens.length; i++) {
      this.secondPassAnnotation(tokens[i], i + 1 < tokens.length ? tokens[i + 1] : null);
    }
    return tokens;
  }

  textContainsSentbreak(text: string): boolean {
    const toks = this.annotateTokens(this.tokenizeWords(text));
    // the last token is ignored
    for (let i = 0; i < toks.length - 1; i++) if (toks[i].sentbreak) return true;
    return false;
  }

  // --- boundary detection ----------------------------------------------------

  private lastWhitespaceIndex(text: string): number {
    for (let i = text.length - 1; i >= 0; i--) if (ASCII_WS.has(text[i])) return i;
    return 0;
  }

  private *matchPotentialEndContexts(
    text: string,
  ): Generator<{ end: number; nextTokStart: number | null; context: string }> {
    let prevStart = 0;
    let prevStop = 0;
    let previous: RegExpExecArray | null = null;
    const ctx = (m: RegExpExecArray, s: number, e: number) =>
      text.slice(s, e) + m[0] + (m.groups?.after_tok ?? "");
    const info = (m: RegExpExecArray, s: number, e: number) => ({
      end: m.index + m[0].length,
      nextTokStart: m.indices?.groups?.next_tok?.[0] ?? null,
      context: ctx(m, s, e),
    });
    PERIOD_CONTEXT.lastIndex = 0;
    for (const match of text.matchAll(PERIOD_CONTEXT)) {
      const m = match as RegExpExecArray;
      const beforeText = text.slice(prevStop, m.index);
      let idx = this.lastWhitespaceIndex(beforeText);
      if (idx) idx += prevStop + 1;
      else idx = prevStart;
      const wordStart = idx;
      const wordStop = m.index;
      if (previous && prevStop <= wordStart) {
        yield info(previous, prevStart, prevStop);
      }
      previous = m;
      prevStart = wordStart;
      prevStop = wordStop;
    }
    if (previous) yield info(previous, prevStart, prevStop);
  }

  private slicesFromText(text: string): [number, number][] {
    const out: [number, number][] = [];
    let lastBreak = 0;
    for (const { end, nextTokStart, context } of this.matchPotentialEndContexts(text)) {
      if (this.textContainsSentbreak(context)) {
        out.push([lastBreak, end]);
        lastBreak = nextTokStart !== null ? nextTokStart : end;
      }
    }
    out.push([lastBreak, pyRstrip(text).length]);
    return out;
  }

  private realignBoundaries(text: string, slices: [number, number][]): [number, number][] {
    const out: [number, number][] = [];
    let realign = 0;
    for (let i = 0; i < slices.length; i++) {
      const s1: [number, number] = [slices[i][0] + realign, slices[i][1]];
      const s2 = i + 1 < slices.length ? slices[i + 1] : null;
      const s1Text = s1[0] < s1[1] ? text.slice(s1[0], s1[1]) : "";
      if (!s2) {
        if (s1Text) out.push(s1);
        continue;
      }
      const m = RE_BOUNDARY_REALIGNMENT.exec(text.slice(s2[0], s2[1]));
      if (m) {
        out.push([s1[0], s2[0] + pyRstrip(m[0]).length]);
        realign = m[0].length;
      } else {
        realign = 0;
        if (s1Text) out.push(s1);
      }
    }
    return out;
  }
}
