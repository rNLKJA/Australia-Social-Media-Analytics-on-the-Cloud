import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "@/lib/__fixtures__/nlp-parity.json";
import { loadEngine } from "@/test/load-engine";
import { sentimentBucket, sentimentDescription } from "../sentiment";
import { htmlToText } from "./html-text";
import {
  cleanContent,
  geocodePlace,
  normalizeString,
  scorePost,
  tokensAndLemmas,
  wordsNgrams,
} from "./pipeline";
import { pyIsUpper, pyLen, pyRound, pySplit } from "./pyre";
import { nltkWordTokenizer, wordTokenize } from "./word-tokenize";

/**
 * Parity with the ORIGINAL Python functions (coursework/.../analyzer.py,
 * processor.py, twitter/utils.py on NLTK 3.8.1 / CPython 3.11). Expected values
 * were produced by scripts/build_nlp_assets.py running the unchanged modules.
 */
const engine = loadEngine();

describe("Python primitives", () => {
  it("rounds like CPython round()", () => {
    expect(pyRound(0.0625, 3)).toBe(0.062); // exact tie -> even
    expect(pyRound(0.0635, 3)).toBe(0.064); // 0.0635 is slightly above the tie in binary
    expect(pyRound(-0.61154, 4)).toBe(-0.6115);
    expect(pyRound(2.675, 2)).toBe(2.67); // binary value is below the tie
    expect(pyRound(0.5, 0)).toBe(0);
    expect(pyRound(1.5, 0)).toBe(2);
  });
  it("splits and measures strings like str.split / len", () => {
    expect(pySplit("a\x1cb\u3000c\ufeffd")).toEqual(["a", "b", "c\ufeffd"]);
    expect(pyLen("😀")).toBe(1);
    expect(pyIsUpper("LOL!")).toBe(true);
    expect(pyIsUpper("123")).toBe(false);
  });
});

describe("notebook example (Sentimental Analysis.ipynb)", () => {
  const input = "Hello ~ What a good weather! hahahhah, lmao!!!!!!!!!!!";
  it("normalises exactly as printed in the notebook", () => {
    expect(normalizeString(engine, input)).toBe(
      "Hello ~ What a good weather ! hahahhah , lmao ! ! ! ! ! ! ! ! ! ! !",
    );
  });
  it("scores the raw string as (8, 'Very Strongly Positive')", () => {
    const bucket = sentimentBucket(engine.sia.polarityScores(input).compound);
    expect([bucket, sentimentDescription(bucket)]).toEqual([8, "Very Strongly Positive"]);
  });
});

describe("pipeline parity on the synthetic corpus", () => {
  for (const ex of fixture.examples) {
    it(JSON.stringify(ex.text).slice(0, 70), () => {
      const trace = scorePost(engine, ex.text);
      expect(trace.cleaned).toBe(ex.cleaned);
      expect(trace.sentences).toEqual(ex.sentences);
      expect(trace.tokens).toEqual(ex.tokens);
      expect(trace.normalized).toBe(ex.normalized);
      expect(trace.scores).toEqual(ex.scores);
      expect(trace.bucket).toBe(ex.bucket);
      expect(trace.description).toBe(ex.description);
      expect(engine.sia.polarityScores(ex.text)).toEqual(ex.rawScores);
    });
  }
});

describe("Punkt + NLTKWordTokenizer", () => {
  for (const [text, sentences, tokens] of fixture.punkt as [string, string[], string[]][]) {
    it(text, () => {
      expect(engine.punkt.tokenize(text)).toEqual(sentences);
      expect(wordTokenize(text, engine.punkt)).toEqual(tokens);
    });
  }
  it("matches the NLTKWordTokenizer docstring example", () => {
    const s =
      "Good muffins cost $3.88 (roughly 3,36 euros)\nin New York.  Please buy me\ntwo of them.\nThanks.";
    expect(nltkWordTokenizer(s)).toEqual([
      "Good",
      "muffins",
      "cost",
      "$",
      "3.88",
      "(",
      "roughly",
      "3,36",
      "euros",
      ")",
      "in",
      "New",
      "York.",
      "Please",
      "buy",
      "me",
      "two",
      "of",
      "them.",
      "Thanks",
      ".",
    ]);
  });
});

describe("WordNet lemmatiser", () => {
  for (const [word, lemma] of fixture.lemmas as [string, string][]) {
    it(`${word} -> ${lemma}`, () => expect(engine.lemmatizer.lemmatize(word)).toBe(lemma));
  }
});

describe("SAL geocoding (twitter/utils.py)", () => {
  it("enumerates n-grams in itertools.combinations order", () => {
    expect(wordsNgrams(["a", "b", "c"])).toEqual(["a", "b", "c", "a b", "a c", "b c", "a b c"]);
  });
  for (const loc of fixture.locations) {
    it(loc.input, () => {
      const r = geocodePlace(engine.salLookup, loc.input);
      expect(r.normalised).toBe(loc.normalised);
      expect(r.ngrams).toBe(loc.ngrams.length);
      expect(r.matched).toBe(loc.matched);
      expect(r.sal).toBe(loc.sal);
    });
  }
});

describe("toot path (harvester/mastodon/toot.py extract_mastodon_info)", () => {
  for (const t of fixture.toots) {
    it(JSON.stringify(t.html).slice(0, 70), () => {
      const trace = scorePost(engine, t.html, "mastodon");
      expect(trace.cleaned).toBe(t.text);
      expect(trace.tokens).toEqual(t.tokens);
      expect(trace.normalized).toBe(t.normalized);
      expect(trace.scores).toEqual(t.scores);
      expect(trace.bucket).toBe(t.bucket);
    });
  }
  it("keeps hashtags and mentions, unlike the tweet path", () => {
    const text = "Feeling #blessed and #happy today";
    expect(scorePost(engine, text, "mastodon").bucket).toBe(9);
    expect(scorePost(engine, text, "twitter").bucket).toBe(5);
  });
});

describe("BeautifulSoup .text", () => {
  const cases: [string, string][] = [
    ["<p>one</p><p>two</p>", "onetwo"],
    ["line<br>break", "linebreak"],
    ["AT&T rocks", "AT&T rocks"],
    ["fish &chips;", "fish &chips"],
    ["&#150; &#x1F600; &#8217;", "\u2013 \u{1F600} \u2019"],
    ["<3 you", "<3 you"],
    ["a < b > c", "a < b > c"],
    ["<script>alert(1)</script>after", "after"],
    ["<style>p{}</style>x", "x"],
    ["<template>t</template>u", "u"],
    ["<!-- c -->y", "y"],
    ["&copy 2023", "\u00a9 2023"],
    ["&amp", "&amp"],
    ["Tom &amp Jerry", "Tom & Jerry"],
    ["&notit; &notin;", "&notit \u2209"],
    ['<a href="x>y">z</a>', "z"],
    ["<b", ""],
    ["<![CDATA[x]]>z", "xz"],
    ["<!DOCTYPE html>q", "q"],
    ["<?php x ?>w", "w"],
    ["</p>closing", "closing"],
    ["a&#10;b", "a\nb"],
    ["<textarea>&amp;</textarea>", "&"],
    // whitespace-only text nodes collapse (BeautifulSoup.endData)
    ["a</a>  <b>x</b>", "a x"],
    ["<p> \n </p>", "\n"],
    ["<pre>  </pre>", "  "],
    ["x  &amp;  y", "x  &  y"],
    ["<b>a</b><!--c-->  <i>b</i>", "a b"],
  ];
  for (const [html, text] of cases) {
    it(JSON.stringify(html), () => expect(htmlToText(html, engine.htmlEntities)).toBe(text));
  }
});

describe("clean_content", () => {
  it("drops mentions, hashtags and links (whitespace around links is kept)", () => {
    expect(
      cleanContent("@someone check this out https://example.com/abc #melbourne #coffee best brunch ever"),
    ).toBe("check this out  best brunch ever");
  });
});

/**
 * Optional local cross-check against real toots scored by the original Python
 * (scripts/build_nlp_assets.py --sample N). The sample contains public toot
 * text, so it lives in /tmp and is never committed; CI skips this block.
 */
const SAMPLE = process.env.NLP_SAMPLE ?? "/tmp/social-sense-nlp-sample.json";
describe.runIf(existsSync(SAMPLE))("local cross-check on real toots", () => {
  it("reproduces BeautifulSoup text, tokens, normalised text, VADER scores and bucket", () => {
    const rows: {
      html?: string;
      text: string;
      tokens?: string[];
      normalized: string;
      scores?: Record<string, number>;
      bucket: number;
    }[] = JSON.parse(readFileSync(SAMPLE, "utf8"));
    const miss = { text: 0, tokens: 0, normalized: 0, scores: 0, bucket: 0 };
    const examples: string[] = [];
    for (const r of rows) {
      if (r.html !== undefined && htmlToText(r.html, engine.htmlEntities) !== r.text) {
        miss.text++;
        if (examples.length < 3) examples.push(`html ${JSON.stringify(r.html).slice(0, 200)}`);
      }
      // `text` is already BeautifulSoup's output; score it from step 2 on
      const { tokens, lemmas } = tokensAndLemmas(engine, r.text);
      const normalized = lemmas.join(" ");
      const scores = engine.sia.polarityScores(normalized);
      if (r.tokens && JSON.stringify(tokens) !== JSON.stringify(r.tokens)) miss.tokens++;
      if (normalized !== r.normalized) {
        miss.normalized++;
        if (examples.length < 3)
          examples.push(`${JSON.stringify(r.normalized)}\n${JSON.stringify(normalized)}`);
      }
      if (r.scores && JSON.stringify(scores) !== JSON.stringify(r.scores)) miss.scores++;
      if (sentimentBucket(scores.compound) !== r.bucket) miss.bucket++;
    }
    if (examples.length) console.log(examples.join("\n---\n"));
    console.log(`sample=${rows.length} mismatches=${JSON.stringify(miss)}`);
    // 44,156 real toots: 0 mismatches in every field at the time of writing
    expect(miss).toEqual({ text: 0, tokens: 0, normalized: 0, scores: 0, bucket: 0 });
  });
});
