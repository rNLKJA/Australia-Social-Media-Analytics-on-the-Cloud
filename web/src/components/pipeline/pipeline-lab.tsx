"use client";

import { AlertTriangle, ArrowRight, Ban, CheckCircle2, Info, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Segmented } from "@/components/scenario/segmented";
import { usePipelineWorker } from "@/hooks/use-pipeline-worker";
import { useThemeName } from "@/hooks/use-theme-name";
import { fmtInt, fmtScore } from "@/lib/format";
import { CRIME_WORDS, INCOME_WORDS } from "@/lib/nlp/keywords";
import type { PostSource } from "@/lib/nlp/pipeline";
import { SENTIMENT } from "@/lib/palette";
import { BUCKET_RANGES, SENTIMENT_BUCKETS } from "@/lib/sentiment";
import { cn } from "@/lib/utils";

export interface SalInfo {
  name: string;
  n: number;
  avg: number;
}

interface Example {
  label: string;
  text: string;
  place?: string;
  /** shown under the verdict while this example is loaded */
  note?: string;
}

const EXAMPLES: Record<PostSource, Example[]> = {
  twitter: [
    {
      label: "The 2023 notebook example",
      text: "Hello ~ What a good weather! hahahhah, lmao!!!!!!!!!!!",
      place: "Melbourne, Victoria",
      note: "The notebook scored this raw string and printed 8 (Very Strongly Positive). The processor scored the normalised text instead, so on the cluster the same tweet got a 9.",
    },
    {
      label: "Rent and housing",
      text: "Can't afford a house in this city. The housing market is so unfair!! @realestate #auspol https://t.co/abc",
      place: "Footscray, Victoria",
    },
    {
      label: "A crime report",
      text: "Police arrested two men after a robbery on Sydney Rd last night. Glad nobody was hurt.",
      place: "Coburg, Victoria",
    },
    {
      label: "Mixed feelings (VADER's 'but' rule)",
      text: "I love Melbourne coffee :) but the rent here is killing me",
      place: "Geelong, Victoria",
    },
    {
      label: "Only tags and a link",
      text: "@metrotrains #melbourne #auspol https://t.co/xyz",
      place: "Melbourne, Victoria",
    },
  ],
  mastodon: [
    {
      label: "Hashtags still count",
      text: '<p>Feeling <a href="https://mastodon.social/tags/blessed" class="mention hashtag" rel="tag">#<span>blessed</span></a> and <a href="https://mastodon.social/tags/happy" class="mention hashtag" rel="tag">#<span>happy</span></a> today</p>',
      note: "As a tweet this scores 5: the processor deletes the hashtags, and with them every sentiment word.",
    },
    {
      label: "A mention",
      text: '<p><span class="h-card"><a href="https://mastodon.au/@someone" class="u-url mention">@<span>someone</span></a></span> you are awful</p>',
    },
    {
      label: "German (English-only lexicon)",
      text: "<p>Die Sonne war hell und der Tag war schön.</p>",
      note: '"die" and "war" are negative words in VADER\'s English lexicon, so a sunny German sentence scores 1.',
    },
    {
      label: "Plain text",
      text: "Worst week ever #fail #sad",
    },
  ],
};

const DEFAULT_EXAMPLE: Record<PostSource, number> = { twitter: 1, mastodon: 0 };

export function PipelineLab({ sals }: { sals: Record<string, SalInfo> }) {
  const id = useId();
  const theme = useThemeName();
  const { status, result, error, score } = usePipelineWorker();
  const [source, setSource] = useState<PostSource>("twitter");
  const [text, setText] = useState(EXAMPLES.twitter[DEFAULT_EXAMPLE.twitter].text);
  const [place, setPlace] = useState(EXAMPLES.twitter[DEFAULT_EXAMPLE.twitter].place ?? "");

  useEffect(() => {
    const t = setTimeout(() => score(text, place, source), 120);
    return () => clearTimeout(t);
  }, [text, place, source, score]);

  const switchSource = (s: PostSource) => {
    if (s === source) return;
    setSource(s);
    // An untouched example (or an empty box) becomes the other path's default
    // example; text the visitor typed is kept so both paths can score it.
    if (!text.trim() || EXAMPLES[source].some((ex) => ex.text === text)) {
      const ex = EXAMPLES[s][DEFAULT_EXAMPLE[s]];
      setText(ex.text);
      setPlace(ex.place ?? "");
    }
  };

  // only show a result for the source it was computed for
  const tr = result?.trace.source === source ? result.trace : undefined;
  const geo = tr ? result?.geo : undefined;
  const sal = geo?.sal ? sals[geo.sal] : undefined;
  const compound = tr?.scores.compound ?? 0;
  const activeExample = EXAMPLES[source].find((ex) => ex.text === text);
  const isTweet = source === "twitter";

  // twitter_processor_v1 kept a tweet only if it had a place matching a suburb
  // and something left to score after cleaning
  const empty = !!tr && isTweet && !tr.normalized;
  const fate: "stored" | "no-place" | "no-match" | "empty" | "toot" | null = !tr
    ? null
    : !isTweet
      ? "toot"
      : empty
        ? "empty"
        : !geo
          ? "no-place"
          : !geo.sal
            ? "no-match"
            : "stored";
  const stored = fate === "stored";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      {/* input */}
      <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Score it as</span>
          <Segmented
            label="Which 2023 code path to use"
            value={source}
            onChange={switchSource}
            options={[
              { value: "twitter", label: "A tweet (MPI processor)" },
              { value: "mastodon", label: "A toot (Mastodon harvester)" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${id}-text`} className="text-sm font-medium">
            {isTweet ? "Tweet text" : "Toot content (plain text or the HTML the API returns)"}
          </label>
          <textarea
            id={`${id}-text`}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            rows={5}
            className="border-input bg-card focus-visible:ring-ring/40 w-full resize-y rounded-md border p-3 text-[0.95rem] leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
            placeholder="Type anything…"
          />
          <p className="text-muted-foreground text-xs">
            Runs entirely in your browser. Nothing is sent or stored.
          </p>
        </div>
        {isTweet && (
          <div className="space-y-2">
            <label htmlFor={`${id}-place`} className="text-sm font-medium">
              Twitter place name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="relative">
              <MapPin
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden
              />
              <input
                id={`${id}-place`}
                value={place}
                onChange={(e) => setPlace(e.target.value.slice(0, 120))}
                className="border-input bg-card focus-visible:ring-ring/40 h-9 w-full rounded-md border pr-3 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
                placeholder="e.g. Coburg, Victoria"
              />
            </div>
          </div>
        )}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium">Try an example</p>
          <ul className="flex flex-wrap gap-1.5">
            {EXAMPLES[source].map((ex) => (
              <li key={ex.label}>
                <button
                  type="button"
                  aria-pressed={text === ex.text}
                  onClick={() => {
                    setText(ex.text);
                    setPlace(ex.place ?? "");
                  }}
                  className={cn(
                    "border-border bg-card hover:border-primary hover:text-primary rounded-full border px-3 py-1 text-xs transition-colors",
                    text === ex.text &&
                      "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                  )}
                >
                  {ex.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* verdict */}
        <div className="border-border bg-card rounded-lg border p-5" aria-live="polite">
          {status === "loading" && !tr && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the lexicon, WordNet and Punkt
              model…
            </p>
          )}
          {status === "error" && (
            <p className="text-destructive flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          {tr && (
            <div className="space-y-3">
              {empty ? (
                <div className="flex items-center gap-4">
                  <div className="border-border text-muted-foreground grid size-16 shrink-0 place-items-center rounded-full border-2 border-dashed">
                    <Ban className="size-6" aria-hidden />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-semibold">Dropped, not scored</p>
                    <p className="text-muted-foreground text-sm">
                      Nothing is left once mentions, hashtags and links are stripped.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div
                    className="num grid size-16 shrink-0 place-items-center rounded-full font-serif text-3xl font-semibold"
                    style={{
                      background: SENTIMENT[theme][tr.bucket - 1],
                      color: tr.bucket <= 2 || tr.bucket >= 8 ? "#fff" : "var(--foreground)",
                    }}
                  >
                    {tr.bucket}
                  </div>
                  <div>
                    <p className="font-serif text-xl font-semibold">{tr.description}</p>
                    <p className="num text-muted-foreground text-sm">
                      compound {compound.toFixed(4)} · scored in {result!.ms.toFixed(1)} ms
                    </p>
                  </div>
                </div>
              )}
              <Fate fate={fate} sal={sal} salCode={geo?.sal ?? null} />
              {activeExample?.note && (
                <p className="text-muted-foreground border-border flex gap-2 border-t pt-3 text-xs leading-relaxed">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {activeExample.note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* steps */}
      <ol className="space-y-4" aria-label="Pipeline steps">
        {isTweet ? (
          <Step n={1} title="Strip mentions, hashtags and links" source="twitter/processor.py">
            {tr && <Mono>{tr.cleaned || <em className="text-muted-foreground">(empty)</em>}</Mono>}
          </Step>
        ) : (
          <Step n={1} title="Turn the HTML into text (BeautifulSoup)" source="harvester/mastodon/toot.py">
            {tr && (
              <div className="space-y-2">
                <Mono>{tr.cleaned || <em className="text-muted-foreground">(empty)</em>}</Mono>
                <p className="text-muted-foreground text-xs">
                  Tags disappear without leaving spaces (so paragraphs run together), entities are decoded,
                  and mentions, hashtags and links stay in: only the tweet processor stripped them.
                </p>
              </div>
            )}
          </Step>
        )}

        <Step
          n={2}
          title="Split into sentences (Punkt) and words (NLTKWordTokenizer)"
          source="nltk.word_tokenize"
        >
          {tr && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {tr.sentences.length} sentence{tr.sentences.length === 1 ? "" : "s"}, {tr.tokens.length}{" "}
                tokens
              </p>
              <div className="flex flex-wrap gap-1">
                {tr.tokens.map((t, i) => (
                  <span
                    key={i}
                    className="num border-border bg-muted/60 rounded border px-1.5 py-0.5 font-mono text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Step>

        <Step n={3} title="Lemmatise every token as a noun (WordNet)" source="analyzer.py normalize_string">
          {tr && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {tr.tokens.map((t, i) =>
                  t !== tr.lemmas[i] ? (
                    <span
                      key={i}
                      className="border-primary/40 bg-highlight/60 rounded border px-1.5 py-0.5 font-mono text-xs"
                    >
                      {t} <ArrowRight className="inline size-3" aria-label="becomes" /> {tr.lemmas[i]}
                    </span>
                  ) : null,
                )}
                {tr.tokens.every((t, i) => t === tr.lemmas[i]) && (
                  <span className="text-muted-foreground text-xs">No token changed.</span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                The default part of speech is noun, so verbs pass through and words like &quot;was&quot;
                become &quot;wa&quot;. The joined result is what VADER scores:
              </p>
              <Mono>{tr.normalized || <em className="text-muted-foreground">(empty)</em>}</Mono>
            </div>
          )}
        </Step>

        <Step n={4} title="Score with VADER" source="nltk.sentiment.vader">
          {tr && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {(["neg", "neu", "pos"] as const).map((k) => (
                  <div key={k} className="border-border rounded-md border p-2">
                    <div className="text-muted-foreground">
                      {k === "neg" ? "Negative" : k === "neu" ? "Neutral" : "Positive"}
                    </div>
                    <div className="num font-serif text-lg font-semibold">{tr.scores[k].toFixed(3)}</div>
                  </div>
                ))}
              </div>
              <CompoundGauge compound={compound} theme={theme} />
            </div>
          )}
        </Step>

        <Step n={5} title="Bucket the compound score into 1-9" source="analyzer.py sentiment_analysis">
          {tr && (
            <div className="grid grid-cols-9 gap-1" role="list" aria-label="Buckets">
              {SENTIMENT_BUCKETS.map((b) => (
                <div
                  key={b}
                  role="listitem"
                  aria-current={b === tr.bucket && !empty ? "true" : undefined}
                  className={cn(
                    "rounded-md border px-1 py-2 text-center transition-all",
                    b === tr.bucket && !empty
                      ? "border-foreground scale-105 shadow-md"
                      : "border-transparent opacity-60",
                  )}
                  style={{ background: SENTIMENT[theme][b - 1] }}
                >
                  <div
                    className={cn(
                      "num font-serif text-base font-semibold",
                      (b <= 2 || b >= 8) && "text-white",
                    )}
                  >
                    {b}
                  </div>
                  <div
                    className={cn(
                      "num text-[9px] leading-tight",
                      b <= 2 || b >= 8 ? "text-white/90" : "text-foreground/70",
                    )}
                  >
                    {BUCKET_RANGES[b]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Step>

        {isTweet ? (
          <>
            <Step n={6} title="Match the place to a suburb (SAL)" source="twitter/utils.py">
              {!geo && (
                <p className="text-muted-foreground text-sm">
                  Add a place name to see the geocoder at work. The 2023 processor skipped tweets without one.
                </p>
              )}
              {geo && (
                <div className="space-y-2 text-sm">
                  <p>
                    Normalised:{" "}
                    <code className="bg-muted rounded px-1 font-mono text-xs">
                      {geo.normalised || "(empty)"}
                    </code>{" "}
                    <span className="text-muted-foreground">
                      ·{" "}
                      {geo.skipped
                        ? "too many words to enumerate"
                        : `${fmtInt(geo.ngrams)} word combinations tried, shortest first`}
                    </span>
                  </p>
                  {geo.sal ? (
                    <p>
                      Matched{" "}
                      <code className="bg-highlight/60 rounded px-1 font-mono text-xs">{geo.matched}</code> →
                      SAL <strong className="num">{geo.sal}</strong>
                      {sal ? (
                        <>
                          {" "}
                          ({sal.name}). In 2022 this suburb had{" "}
                          <strong className="num">{fmtInt(sal.n)}</strong> geotagged tweets averaging{" "}
                          <strong className="num">{fmtScore(sal.avg)}</strong>.{" "}
                          <Link className="link" href="/twitter">
                            See the map
                          </Link>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {" "}
                          (not one of the 1,085 Victorian suburbs with tweets in the saved views)
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      No suburb matched, so the 2023 processor would have dropped this tweet.
                    </p>
                  )}
                </div>
              )}
            </Step>

            <Step
              n={7}
              title="Would CouchDB's MapReduce views count it?"
              source="MapReduce/Income, MapReduce/Crime"
            >
              {tr && (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ViewHit label="Income view" hit={tr.income} words={INCOME_WORDS} stored={stored} />
                    <ViewHit label="Crime view" hit={tr.crime} words={CRIME_WORDS} stored={stored} />
                  </div>
                  {!stored && (
                    <p className="text-muted-foreground text-xs">
                      The views only see stored tweets, and this one was dropped at an earlier step.
                    </p>
                  )}
                </div>
              )}
            </Step>
          </>
        ) : (
          <Step n={6} title="Store the toot with its score" source="harvester/mastodon/harvester.py">
            <p className="text-muted-foreground text-sm">
              Each server had its own CouchDB database. Toots carried no place, so there was no suburb to
              match and no income or crime view: the dashboard plotted one 1-9 histogram per server.{" "}
              <Link className="link" href="/mastodon">
                See the Mastodon page
              </Link>
            </p>
          </Step>
        )}
      </ol>
    </div>
  );
}

/** What the 2023 code would have done with the post after scoring it. */
function Fate({
  fate,
  sal,
  salCode,
}: {
  fate: "stored" | "no-place" | "no-match" | "empty" | "toot" | null;
  sal?: SalInfo;
  salCode: string | null;
}) {
  if (!fate || fate === "empty") return null;
  const ok = fate === "stored" || fate === "toot";
  const message =
    fate === "stored"
      ? sal
        ? `Kept: stored under ${sal.name}, so it counts on the suburb map.`
        : salCode?.startsWith("2")
          ? `Kept: stored under SAL ${salCode}, a Victorian suburb with no tweets in the saved 2022 views.`
          : `Kept: stored under SAL ${salCode}, outside Victoria (this site maps Victoria only).`
      : fate === "toot"
        ? "Kept: stored in the server's Mastodon database with this score."
        : fate === "no-place"
          ? "Dropped: without a place the 2023 processor skipped the tweet. Add one below the text."
          : "Dropped: the place did not match a suburb, so the tweet was never stored.";
  return (
    <p className={cn("flex items-start gap-2 text-sm", ok ? "text-foreground" : "text-muted-foreground")}>
      {ok ? (
        <CheckCircle2 className="text-sent-pos mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      {message}
    </p>
  );
}

function Step({
  n,
  title,
  source,
  children,
}: {
  n: number;
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-border bg-card rounded-lg border p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-baseline gap-2 font-medium">
          <span className="num bg-primary text-primary-foreground grid size-6 place-items-center rounded-full text-xs">
            {n}
          </span>
          {title}
        </h3>
        <code className="text-muted-foreground font-mono text-[11px]">{source}</code>
      </div>
      {children}
    </li>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-muted/70 rounded-md p-3 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap">
      {children}
    </p>
  );
}

function ViewHit({
  label,
  hit,
  words,
  stored,
}: {
  label: string;
  hit: string | null;
  words: readonly string[];
  stored: boolean;
}) {
  const counted = stored && !!hit;
  return (
    <div
      className={cn("rounded-md border p-3", counted ? "border-primary/50 bg-highlight/30" : "border-border")}
    >
      <p className="text-sm font-medium">
        {label}: {!stored ? "not counted" : hit ? "yes" : "no"}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {hit ? (
          <>
            {stored ? "matched" : "would match"} <code className="font-mono">{hit}</code>
            {!stored && ", but the tweet was not stored"}
          </>
        ) : (
          <>looks for {words.slice(0, 6).join(", ")}…</>
        )}
      </p>
    </div>
  );
}

function CompoundGauge({ compound, theme }: { compound: number; theme: "light" | "dark" }) {
  const pct = ((compound + 1) / 2) * 100;
  return (
    <div>
      <div
        className="relative h-3 rounded-full"
        style={{ background: `linear-gradient(to right, ${SENTIMENT[theme].join(", ")})` }}
        aria-hidden
      >
        <span
          className="border-foreground bg-background absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow transition-[left] duration-300"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="num text-muted-foreground mt-1 flex justify-between text-[11px]">
        <span>−1</span>
        <span>compound {compound.toFixed(4)}</span>
        <span>+1</span>
      </div>
    </div>
  );
}
