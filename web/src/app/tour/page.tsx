import { ArrowRight, Clapperboard, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/editorial/page-header";
import { LazyVideo } from "@/components/tour/lazy-video";
import { ScreenshotGallery } from "@/components/tour/screenshot-gallery";
import { Button } from "@/components/ui/button";
import {
  MOCK_LABEL,
  MOCK_PREFIX,
  SCREENSHOTS,
  WALKTHROUGHS,
  type Walkthrough,
  walkthroughMedia,
} from "@/lib/showcase";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guided tour",
  description:
    "Three short captioned walkthroughs (the story of the 2023 cloud system, income against sentiment with Moran's I, and Ask the data with a mocked AI reply) and screenshots of every key feature, recorded by a reproducible Playwright script.",
};

const specUrl = `${SITE.repo}/blob/main/web/e2e/showcase.spec.ts`;

export default function TourPage() {
  return (
    <>
      <PageHeader
        kicker="Guided tour"
        title="The project in three short walkthroughs"
        lede={
          <>
            Each video follows one workflow from start to finish, with the step shown on screen and as
            captions. A Playwright script recorded them from this site and checked every step on the way (the
            recovered 2023 numbers, the live correlation, Moran&apos;s I at two thresholds, the validator
            verdict, the audit-log record), so a broken feature fails the recording instead of producing a
            misleading video.
          </>
        }
      >
        <nav aria-label="Walkthroughs" className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm sm:text-base">
          {WALKTHROUGHS.map((w, i) => (
            <a key={w.id} href={`#${w.id}`} className="link">
              {i + 1}. {w.title}
            </a>
          ))}
          <a href="#screenshots" className="link">
            Screenshots
          </a>
        </nav>
      </PageHeader>

      {WALKTHROUGHS.map((w, i) => (
        <WalkthroughSection key={w.id} walkthrough={w} index={i} />
      ))}

      <Section
        id="screenshots"
        kicker="Screenshots"
        title="Every key feature at a glance"
        intro={
          <p>
            Captured by the same script in light mode at 1440 × 900 (the landing page also in dark mode) and
            on a 390 px phone. Select one to enlarge it; the arrow keys step through the set.
          </p>
        }
      >
        <ScreenshotGallery items={SCREENSHOTS} />
      </Section>

      <section aria-labelledby="how-made" className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="border-border bg-card grid gap-4 rounded-lg border p-5 sm:p-6 md:grid-cols-[auto_1fr]">
          <Clapperboard className="text-primary size-6" aria-hidden />
          <div className="space-y-2">
            <h2 id="how-made" className="font-serif text-xl font-semibold">
              How these were made
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <code>pnpm showcase</code> runs{" "}
              <a href={specUrl} className="link">
                web/e2e/showcase.spec.ts
              </a>{" "}
              on the system Chrome. It plays each journey at a human pace with an on-screen caption and a
              visible cursor, asserts what it shows, and records it at 1280 × 800; ffmpeg then encodes the
              H.264 videos on this page and the GIFs in the README. The captions, the step lists here and the
              README walkthrough are the same text. The statistics use the site&apos;s fixed seed 57, so a
              re-run shows the same numbers.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              No real API key is used anywhere in these recordings. Where the AI feature appears, the key is a
              placeholder, every request to the provider is intercepted in the browser, and the reply is a
              labelled mock whose text starts with &ldquo;{MOCK_PREFIX}&rdquo;. The SQL it returns still goes
              through this site&apos;s real validator and runs on the real read-only database.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

/** "Steps 6 to 10" for a run of consecutive steps, otherwise "Steps 2, 5 and 7". */
function stepRange(steps: readonly number[]) {
  const sorted = [...steps].sort((a, b) => a - b);
  const consecutive = sorted.every((s, i) => i === 0 || s === sorted[i - 1] + 1);
  if (sorted.length > 2 && consecutive) return `Steps ${sorted[0]} to ${sorted.at(-1)}`;
  if (sorted.length === 1) return `Step ${sorted[0]}`;
  return `Steps ${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
}

function WalkthroughSection({ walkthrough: w, index }: { walkthrough: Walkthrough; index: number }) {
  const media = walkthroughMedia(w.id);
  const mocked = new Set(w.mockedSteps ?? []);
  const stepsId = `${w.id}-steps`;
  return (
    <Section
      id={w.id}
      kicker={`Walkthrough ${index + 1} of ${WALKTHROUGHS.length} · ${w.routes.map((r) => (r === "/" ? "the landing page" : r)).join(" → ")}`}
      title={w.title}
      intro={<p>{w.summary}</p>}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <figure className="min-w-0 space-y-3">
          <LazyVideo
            src={media.mp4}
            poster={media.poster}
            captions={media.captions}
            label={`${w.title}: a ${w.steps.length}-step walkthrough with captions`}
            width={1280}
            height={800}
          />
          <figcaption className="text-muted-foreground flex flex-wrap items-start gap-x-4 gap-y-1 text-xs leading-relaxed">
            <span className="min-w-0 flex-1">
              <span className="text-foreground font-medium">Setup:</span> {w.setup}
            </span>
            <a href={media.mp4} className="link">
              Open the MP4
            </a>
          </figcaption>
          {mocked.size > 0 && (
            <p className="flex gap-2.5 rounded-lg border border-dashed border-amber-600/50 bg-amber-100/50 p-3 text-sm dark:border-amber-400/40 dark:bg-amber-400/10">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
              <span>
                <strong>{MOCK_LABEL}.</strong> {stepRange([...mocked])} show a reply from a mock, not a model:
                the key is a placeholder and requests to the provider are intercepted in the browser. They
                show how the feature labels, validates, cites and logs a reply, not what a real model would
                say.
              </span>
            </p>
          )}
        </figure>

        <div className="space-y-4">
          <h3 id={stepsId} className="font-serif text-lg font-semibold">
            Steps <span className="text-muted-foreground font-sans text-sm font-normal">(transcript)</span>
          </h3>
          <ol aria-labelledby={stepsId} className="space-y-2">
            {w.steps.map((step, k) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="num bg-primary/10 text-primary flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-xs font-semibold">
                  {k + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">
                  {step}
                  {mocked.has(k + 1) && (
                    <span className="block text-xs text-amber-800 dark:text-amber-300">{MOCK_LABEL}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline">
            <Link href={w.routes[0]}>
              Try it yourself <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
