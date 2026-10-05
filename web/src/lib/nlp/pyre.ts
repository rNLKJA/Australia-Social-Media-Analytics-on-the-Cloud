/**
 * Python-compatible text primitives.
 *
 * The 2023 pipeline ran on CPython 3.11 + NLTK 3.8.1. Python's `re` module and
 * `str` methods are Unicode-aware in ways JavaScript's defaults are not
 * (`\w`, `\d`, `\s`, `\b`, `str.split()`, `str.isupper()`, `len()`), so the
 * ports in this folder build their regular expressions from these classes
 * instead of JS shorthands.
 */

/** Python `\w` for str patterns: alphanumeric (str.isalnum) or underscore. */
export const W = String.raw`[\p{L}\p{N}_]`;
/** Python `\W`. */
export const NW = String.raw`[^\p{L}\p{N}_]`;
/** Python `\d` for str patterns: Unicode decimal digits (Nd). */
export const D = String.raw`\p{Nd}`;
/** Python `[^\W\d]`: word characters that are not decimal digits. */
export const ALPHA = String.raw`[\p{L}\p{Nl}\p{No}_]`;

/** Characters for which Python's `str.isspace()` is true (as regex class body). */
const WS_CHARS = [
  String.raw`\t\n\v\f\r\x1c-\x20\x85\xa0`,
  // U+1680, U+2000-U+200A, U+2028, U+2029, U+202F, U+205F, U+3000
  ...[[0x1680], [0x2000, 0x200a], [0x2028], [0x2029], [0x202f], [0x205f], [0x3000]].map((r) =>
    r.map((cp) => `\\u${cp.toString(16).padStart(4, "0")}`).join("-"),
  ),
].join("");
/** Python `\s`. */
export const S = `[${WS_CHARS}]`;
/** Python `\S`. */
export const NS = `[^${WS_CHARS}]`;

/** Python `\b` (Unicode word boundary) via lookarounds. */
export const B = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;

/**
 * Python's `$` without MULTILINE matches at the end of the string *or* just
 * before a trailing newline.
 */
export const END = String.raw`(?=\n?$)`;

const WS_RE = new RegExp(`${S}+`, "u");
const LEADING_WS = new RegExp(`^${S}+`, "u");
const TRAILING_WS = new RegExp(`${S}+$`, "u");

/** `str.split()` with no arguments. */
export function pySplit(s: string): string[] {
  return s.split(WS_RE).filter((t) => t.length > 0);
}

/** `str.strip()` with no arguments. */
export function pyStrip(s: string): string {
  return s.replace(LEADING_WS, "").replace(TRAILING_WS, "");
}

/** `str.rstrip()` with no arguments. */
export function pyRstrip(s: string): string {
  return s.replace(TRAILING_WS, "");
}

/** `len(s)`: Python counts code points, not UTF-16 units. */
export function pyLen(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // count a surrogate pair once
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
    n++;
  }
  return n;
}

const UPPER = /\p{Uppercase}/u;
const LOWER = /\p{Lowercase}/u;
const TITLE = /\p{Lt}/u;

/**
 * `str.isupper()`: no lowercase or titlecase characters and at least one
 * uppercase character (CPython uses the derived Uppercase/Lowercase props).
 */
export function pyIsUpper(s: string): boolean {
  let cased = false;
  for (const ch of s) {
    if (LOWER.test(ch) || TITLE.test(ch)) return false;
    if (!cased && UPPER.test(ch)) cased = true;
  }
  return cased;
}

/** `str.islower()`. */
export function pyIsLower(s: string): boolean {
  let cased = false;
  for (const ch of s) {
    if (UPPER.test(ch) || TITLE.test(ch)) return false;
    if (!cased && LOWER.test(ch)) cased = true;
  }
  return cased;
}

/** First code point of a string (Python `s[0]`). */
export function firstChar(s: string): string {
  const cp = s.codePointAt(0);
  return cp === undefined ? "" : String.fromCodePoint(cp);
}

/**
 * Python's `round(x, n)` for floats: correctly rounded from the exact binary
 * value, with exact ties going to the even digit.
 */
export function pyRound(x: number, n: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const neg = x < 0;
  // toFixed(100) yields the exact decimal expansion for magnitudes we use.
  const exact = Math.abs(x).toFixed(100);
  const dot = exact.indexOf(".");
  const intPart = exact.slice(0, dot);
  const frac = exact.slice(dot + 1);
  const keep = frac.slice(0, n);
  const next = frac.charCodeAt(n) - 48;
  const rest = frac.slice(n + 1);
  const restNonZero = /[1-9]/.test(rest);
  let digits = intPart + keep;
  let roundUp = false;
  if (next > 5) roundUp = true;
  else if (next === 5) {
    if (restNonZero) roundUp = true;
    else {
      const last = digits.charCodeAt(digits.length - 1) - 48;
      roundUp = last % 2 === 1;
    }
  }
  if (roundUp) {
    // increment the decimal string
    const arr = digits.split("");
    let i = arr.length - 1;
    while (i >= 0) {
      if (arr[i] === "9") {
        arr[i] = "0";
        i--;
      } else {
        arr[i] = String.fromCharCode(arr[i].charCodeAt(0) + 1);
        break;
      }
    }
    digits = (i < 0 ? "1" : "") + arr.join("");
  }
  const intLen = digits.length - n;
  const str = n > 0 ? `${digits.slice(0, intLen)}.${digits.slice(intLen)}` : digits;
  const v = Number(str);
  return neg ? -v : v;
}

/** Escape a literal string for use inside a RegExp. */
export function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
}
