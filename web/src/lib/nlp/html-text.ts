/**
 * `BeautifulSoup(html, "html.parser").text` (bs4 4.11 on CPython 3.11), as the
 * 2023 Mastodon harvester applied it to every toot before scoring
 * (coursework/1_Flask_Backend/harvester/mastodon/toot.py).
 *
 * The behaviour mirrored here, checked against the Python output in
 * nlp-parity.json and on real toots:
 *   - tags, end tags, comments, declarations and processing instructions
 *     vanish without leaving whitespace (`<p>a</p><p>b</p>` -> "ab", `<br>` -> "");
 *   - the contents of <script>, <style> and <template> are dropped, CDATA kept;
 *   - "<" not followed by a letter, "/", "!" or "?" is literal text ("<3");
 *   - named references are looked up in bs4's HTML5 table (with or without the
 *     ";"), unknown names stay literal minus their ";" ("&foo;" -> "&foo");
 *   - numeric references below 256 are read as Windows-1252 (`&#150;` -> "–");
 *   - a reference cut off by the end of the input stays literal ("&amp");
 *   - a text node made only of ASCII whitespace collapses to one space, or to
 *     "\n" if it contains a newline, except inside <pre> and <textarea>
 *     (BeautifulSoup.endData).
 */

const CP1252: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

function charref(name: string): string {
  const n = name[0] === "x" || name[0] === "X" ? parseInt(name.slice(1), 16) : parseInt(name, 10);
  if (n < 256 && CP1252[n] !== undefined) return String.fromCodePoint(CP1252[n]);
  if (!Number.isFinite(n) || n > 0x10ffff) return "�";
  return String.fromCodePoint(n);
}

// html.parser's patterns (Lib/html/parser.py, Lib/_markupbase.py)
const ENTITYREF = /&([a-zA-Z][-.a-zA-Z0-9]*)[^a-zA-Z0-9]/y;
const CHARREF = /&#(?:[0-9]+|[xX][0-9a-fA-F]+)[^0-9a-fA-F]/y;
const START_TAG = /<([a-zA-Z][^\t\n\r\f />\x00]*)(?:"[^"]*"|'[^']*'|[^'">])*>/y;
const END_TAG = /<\/[^>]*>/y;
const RAW_TEXT = new Set(["script", "style"]);
const PRESERVE = new Set(["pre", "textarea"]);
const ASCII_SPACE = /^[ \n\t\f\r]+$/;

export function htmlToText(html: string, entities: Record<string, string>): string {
  const out: string[] = [];
  const n = html.length;
  let hidden = 0; // depth inside <template> (script/style are skipped wholesale)
  let preserve = 0; // depth inside <pre>/<textarea>
  let i = 0;
  // the current text node: consecutive data and references between two pieces of markup
  let cur: string[] = [];
  const emit = (s: string) => {
    if (!hidden) cur.push(s);
  };
  const flush = () => {
    if (!cur.length) return;
    let text = cur.join("");
    cur = [];
    if (!preserve && ASCII_SPACE.test(text)) text = text.includes("\n") ? "\n" : " ";
    out.push(text);
  };
  while (i < n) {
    const lt = html.indexOf("<", i);
    const amp = html.indexOf("&", i);
    const j = Math.min(lt < 0 ? n : lt, amp < 0 ? n : amp);
    if (j > i) emit(html.slice(i, j));
    i = j;
    if (i >= n) break;

    if (html[i] === "<") {
      const next = html[i + 1] ?? "";
      if (/[a-zA-Z]/.test(next)) {
        START_TAG.lastIndex = i;
        const m = START_TAG.exec(html);
        if (!m) break; // unterminated start tag at the end: dropped
        flush();
        const tag = m[1].toLowerCase();
        i = START_TAG.lastIndex;
        const selfClosing = m[0].endsWith("/>");
        if (PRESERVE.has(tag) && !selfClosing) preserve++;
        if (RAW_TEXT.has(tag) && !selfClosing) {
          // raw text up to the matching end tag, never parsed and never shown
          const end = html.toLowerCase().indexOf(`</${tag}`, i);
          if (end < 0) break;
          const close = html.indexOf(">", end);
          i = close < 0 ? n : close + 1;
        } else if (tag === "template" && !selfClosing) {
          hidden++;
        }
      } else if (next === "/") {
        END_TAG.lastIndex = i;
        const m = END_TAG.exec(html);
        if (!m) break;
        flush();
        const name = m[0].slice(2, -1).trim().toLowerCase();
        if (name === "template" && hidden) hidden--;
        if (PRESERVE.has(name) && preserve) preserve--;
        i = END_TAG.lastIndex;
      } else if (html.startsWith("<!--", i)) {
        const end = html.indexOf("-->", i + 4);
        if (end < 0) break;
        flush();
        i = end + 3;
      } else if (html.startsWith("<![CDATA[", i)) {
        const end = html.indexOf("]]>", i + 9);
        if (end < 0) break;
        flush();
        emit(html.slice(i + 9, end));
        flush();
        i = end + 3;
      } else if (next === "!" || next === "?") {
        const end = html.indexOf(">", i + 2);
        if (end < 0) break;
        flush();
        i = end + 1;
      } else {
        emit("<");
        i += 1;
      }
      continue;
    }

    // "&"
    if (html[i + 1] === "#") {
      CHARREF.lastIndex = i;
      const m = CHARREF.exec(html);
      if (m) {
        emit(charref(m[0].slice(2, -1)));
        i = m[0].endsWith(";") ? CHARREF.lastIndex : CHARREF.lastIndex - 1;
        continue;
      }
      if (html.indexOf(";", i) >= 0) {
        emit("&#");
        i += 2;
        continue;
      }
      break; // incomplete reference at the end stays literal
    }
    ENTITYREF.lastIndex = i;
    const m = ENTITYREF.exec(html);
    if (m) {
      const name = m[1];
      emit(Object.prototype.hasOwnProperty.call(entities, name) ? entities[name] : `&${name}`);
      i = m[0].endsWith(";") ? ENTITYREF.lastIndex : ENTITYREF.lastIndex - 1;
      continue;
    }
    if (/[a-zA-Z#]/.test(html[i + 1] ?? "")) break; // "&name" cut off by the end
    emit("&");
    i += 1;
  }
  if (i < n) {
    // html.parser hands any unparsed tail (e.g. "&amp" at the very end) back as text,
    // except an unterminated tag, which bs4 drops
    const tail = html.slice(i);
    if (!/^<[a-zA-Z/!?]/.test(tail)) emit(tail);
  }
  flush();
  return out.join("");
}
