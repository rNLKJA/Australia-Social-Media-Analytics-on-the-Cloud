"use client";

import { useMemo, useState } from "react";
import { DivergingLegend, NoDataSwatch, SequentialLegend } from "@/components/charts/legends";
import { LazyChoroplethMap as ChoroplethMap } from "@/components/map/lazy-map";
import { MELB_BOUNDS, VIC_BOUNDS } from "@/components/map/bounds";
import { RegionSearch } from "@/components/scenario/region-search";
import { Segmented } from "@/components/scenario/segmented";
import { ThresholdControl } from "@/components/scenario/threshold-control";
import { useThemeName } from "@/hooks/use-theme-name";
import { fmtCompact, fmtInt, fmtScore } from "@/lib/format";
import { NO_DATA, SEQUENTIAL, divergingColor, quantileBreaks, sequentialColor } from "@/lib/palette";
import { sentimentDescription } from "@/lib/sentiment";
import type { SalRegion, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

type Measure = "avg" | "count";

const TOPIC_LABEL: Record<Topic, string> = {
  all: "All tweets",
  income: "Income tweets",
  crime: "Crime tweets",
};

export function TwitterExplorer({ regions }: { regions: SalRegion[] }) {
  const theme = useThemeName();
  const [topic, setTopic] = useState<Topic>("all");
  const [measure, setMeasure] = useState<Measure>("avg");
  const [minTweets, setMinTweets] = useState(1);
  const [view, setView] = useState<"vic" | "melb">("melb");
  const [selected, setSelected] = useState<string | null>(null);

  const byCode = useMemo(() => new Map(regions.map((r) => [r.code, r])), [regions]);
  const withTopic = useMemo(
    () => regions.filter((r) => r[topic] && r[topic]!.n >= minTweets),
    [regions, topic, minTweets],
  );
  const breaks = useMemo(
    () =>
      quantileBreaks(
        withTopic.map((r) => r[topic]!.n),
        7,
      ),
    [withTopic, topic],
  );

  const fills = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of withTopic) {
      const a = r[topic]!;
      out[r.code] =
        measure === "avg" ? divergingColor(a.avg, 5.5, 2, theme) : sequentialColor(a.n, breaks, theme);
    }
    return out;
  }, [withTopic, topic, measure, breaks, theme]);

  const sel = selected ? byCode.get(selected) : undefined;
  const totals = useMemo(() => {
    let n = 0;
    let sum = 0;
    for (const r of withTopic) {
      n += r[topic]!.n;
      sum += r[topic]!.sum;
    }
    return { n, mean: n ? sum / n : 0 };
  }, [withTopic, topic]);

  return (
    <div className="space-y-5">
      <div className="border-border bg-card grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[auto_auto_minmax(11rem,1fr)_auto_minmax(13rem,1fr)] xl:items-start">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Tweets</span>
          <Segmented
            label="Topic"
            value={topic}
            onChange={setTopic}
            options={[
              { value: "all", label: "All" },
              { value: "income", label: "Income" },
              { value: "crime", label: "Crime" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Colour by</span>
          <Segmented
            label="Measure"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: "avg", label: "Average mood" },
              { value: "count", label: "Tweet volume" },
            ]}
          />
        </div>
        <ThresholdControl
          value={minTweets}
          onChange={setMinTweets}
          max={100}
          label="Minimum tweets per suburb"
        />
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Zoom to</span>
          <Segmented
            label="Map extent"
            value={view}
            onChange={setView}
            options={[
              { value: "melb", label: "Melbourne" },
              { value: "vic", label: "Victoria" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Find</span>
          <RegionSearch
            placeholder="A suburb, e.g. Carlton"
            items={regions.map((r) => ({
              code: r.code,
              name: r.name,
              hint: r.all ? fmtCompact(r.all.n) : undefined,
            }))}
            onPick={setSelected}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          <ChoroplethMap
            geoUrl="/geo/vic-sal.topo.json"
            objectName="sal"
            fills={fills}
            noDataColor={NO_DATA[theme]}
            selected={selected}
            onSelect={setSelected}
            bounds={view === "melb" ? MELB_BOUNDS : VIC_BOUNDS}
            ariaLabel="Map of Victorian suburbs coloured by tweet sentiment or volume"
            className="h-[480px] md:h-[600px]"
            describe={(code, name) => {
              const r = byCode.get(code);
              const a = r?.[topic];
              return {
                title: r?.name ?? name,
                lines: a
                  ? [
                      `${TOPIC_LABEL[topic]}: ${fmtInt(a.n)}`,
                      `Average score: ${fmtScore(a.avg)} (${sentimentDescription(Math.round(a.avg))})`,
                    ]
                  : [`No ${topic === "all" ? "" : `${topic} `}tweets`],
              };
            }}
          />
          <div className="flex flex-wrap items-end justify-between gap-3">
            {measure === "avg" ? (
              <DivergingLegend
                mid={5.5}
                spread={2}
                label="Average sentiment score (1 = very negative, 9 = very positive)"
              />
            ) : (
              <SequentialLegend
                label="Tweets per suburb (quantile classes)"
                breaks={breaks}
                colors={SEQUENTIAL[theme]}
                format={fmtCompact}
              />
            )}
            <NoDataSwatch color={NO_DATA[theme]} label="No tweets at this threshold" />
          </div>
        </div>

        <aside aria-live="polite" className="space-y-4">
          <div className="border-border bg-card rounded-lg border p-4">
            <p className="kicker">Showing</p>
            <p className="num mt-1 font-serif text-3xl font-semibold">{fmtInt(withTopic.length)}</p>
            <p className="text-muted-foreground text-sm">
              suburbs with {fmtInt(totals.n)} {topic === "all" ? "" : `${topic} `}tweets; pooled average{" "}
              <span className="num text-foreground font-medium">{totals.mean.toFixed(2)}</span>
            </p>
          </div>
          <div
            className={cn(
              "border-border bg-card rounded-lg border p-4",
              !sel && "text-muted-foreground text-sm",
            )}
          >
            {sel ? (
              <>
                <p className="kicker">Suburb (SAL {sel.code})</p>
                <h3 className="mt-1 font-serif text-2xl font-semibold">{sel.name}</h3>
                <p className="text-muted-foreground text-xs">
                  {sel.sa2Name && <>SA2 {sel.sa2Name}</>}
                  {sel.lgaName && <> · {sel.lgaName}</>}
                </p>
                <dl className="mt-4 space-y-3">
                  {(["all", "income", "crime"] as const).map((t) => {
                    const a = sel[t];
                    return (
                      <div
                        key={t}
                        className="border-border/60 flex items-baseline justify-between gap-3 border-b pb-2 last:border-0"
                      >
                        <dt className="text-muted-foreground text-sm">{TOPIC_LABEL[t]}</dt>
                        <dd className="num text-right text-sm">
                          {a ? (
                            <>
                              <span className="font-semibold">{fmtInt(a.n)}</span>
                              <span className="ml-2 inline-flex items-center gap-1">
                                <span
                                  className="inline-block size-2.5 rounded-full"
                                  style={{ background: divergingColor(a.avg, 5.5, 2, theme) }}
                                  aria-hidden
                                />
                                {fmtScore(a.avg)}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">none</span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="text-muted-foreground mt-3 text-[11px]">
                  Averages are the original dashboard&apos;s values: sum of 1-9 scores ÷ tweets, rounded to
                  two decimals.
                </p>
              </>
            ) : (
              "Click a suburb or search for one to compare all, income and crime tweets."
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
