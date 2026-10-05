"use client";

import { useMemo, useState } from "react";
import { DivergingLegend, NoDataSwatch, SequentialLegend } from "@/components/charts/legends";
import { ScatterPlot, type ScatterPoint } from "@/components/charts/scatter-plot";
import { LazyChoroplethMap as ChoroplethMap } from "@/components/map/lazy-map";
import { CorrelationReadout } from "@/components/scenario/correlation-readout";
import { RegionSearch } from "@/components/scenario/region-search";
import { Segmented } from "@/components/scenario/segmented";
import { ThresholdControl } from "@/components/scenario/threshold-control";
import { useThemeName } from "@/hooks/use-theme-name";
import { fmtCompact, fmtInt, fmtScore } from "@/lib/format";
import { NO_DATA, SEQUENTIAL, divergingColor, quantileBreaks, sequentialColor } from "@/lib/palette";
import { sentimentDescription } from "@/lib/sentiment";
import { correlate, describeStrength } from "@/lib/stats";
import { CRIME_CATEGORIES, type CrimeRegion, type StoredCorrelation } from "@/lib/types";
import { cn } from "@/lib/utils";

type MapMetric = "total" | "crime" | "all";
type YMetric = "crime" | "all";

const MID = 5.2;
const SPREAD = 1.6;

export function CrimeExplorer({ regions, stored }: { regions: CrimeRegion[]; stored: StoredCorrelation[] }) {
  const theme = useThemeName();
  const [mapMetric, setMapMetric] = useState<MapMetric>("total");
  const [yMetric, setYMetric] = useState<YMetric>("crime");
  const [minTweets, setMinTweets] = useState(1);
  const [withOutliers, setWithOutliers] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const byCode = useMemo(() => new Map(regions.map((r) => [r.code, r])), [regions]);
  const pool = useMemo(() => (withOutliers ? regions : regions.filter((r) => r.kept)), [regions, withOutliers]);
  const breaks = useMemo(() => quantileBreaks(pool.map((r) => r.total), 7), [pool]);
  const rank = useMemo(() => {
    const sorted = [...regions].sort((a, b) => b.total - a.total);
    return new Map(sorted.map((r, i) => [r.code, i + 1]));
  }, [regions]);

  const yOf = (r: CrimeRegion, m: YMetric) => (m === "crime" ? r.avgCrime : r.avgAll);
  const wOf = (r: CrimeRegion, m: YMetric) => (m === "crime" ? r.tweetsCrime : r.tweetsAll);

  const fills = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of pool) {
      if (mapMetric === "total") out[r.code] = sequentialColor(r.total, breaks, theme);
      else {
        const v = yOf(r, mapMetric);
        if (v !== null && wOf(r, mapMetric) >= minTweets) out[r.code] = divergingColor(v, MID, SPREAD, theme);
      }
    }
    return out;
  }, [pool, mapMetric, breaks, theme, minTweets]);

  const fitRegions = useMemo(
    () => pool.filter((r) => yOf(r, yMetric) !== null && wOf(r, yMetric) >= minTweets),
    [pool, yMetric, minTweets],
  );
  const corr = useMemo(
    () => correlate(fitRegions.map((r) => r.total), fitRegions.map((r) => yOf(r, yMetric) as number)),
    [fitRegions, yMetric],
  );
  const storedMatch = withOutliers
    ? undefined
    : stored.find(
        (s) => s.unit === "lga" && s.yMetric === (yMetric === "crime" ? "avg_crime" : "avg_all") && s.minTweets === minTweets,
      );

  const points: ScatterPoint[] = useMemo(
    () =>
      fitRegions.map((r) => {
        const yv = yOf(r, yMetric) as number;
        return {
          id: r.code,
          x: r.total,
          y: yv,
          n: wOf(r, yMetric),
          label: r.name.replace(/ \((C|S|RC|B)\)$/, ""),
          color: divergingColor(yv, MID, SPREAD, theme),
        };
      }),
    [fitRegions, yMetric, theme],
  );
  const annotate = useMemo(
    () => [...fitRegions].sort((a, b) => wOf(b, yMetric) - wOf(a, yMetric)).slice(0, 4).map((r) => r.code),
    [fitRegions, yMetric],
  );

  const sel = selected ? byCode.get(selected) : undefined;
  const topic = yMetric === "crime" ? "crime-related tweets" : "all geotagged tweets";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Map shows</span>
          <Segmented
            label="Map metric"
            value={mapMetric}
            onChange={setMapMetric}
            options={[
              { value: "total", label: "Recorded offences" },
              { value: "crime", label: "Crime-tweet sentiment" },
              { value: "all", label: "All-tweet sentiment" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Chart compares offences with</span>
          <Segmented
            label="Sentiment measure"
            value={yMetric}
            onChange={setYMetric}
            options={[
              { value: "crime", label: "Crime tweets" },
              { value: "all", label: "All tweets" },
            ]}
          />
        </div>
        <ThresholdControl value={minTweets} onChange={setMinTweets} max={40} className="xl:w-56" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={withOutliers}
              onChange={(e) => setWithOutliers(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Include the 7 IQR outliers (e.g. Melbourne)
          </label>
          <RegionSearch
            className="sm:w-56"
            placeholder="Find an LGA (e.g. Ballarat)"
            items={regions.map((r) => ({ code: r.code, name: r.name, hint: fmtCompact(r.total) }))}
            onPick={setSelected}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <ChoroplethMap
            geoUrl="/geo/vic-lga.topo.json"
            objectName="lga"
            fills={fills}
            noDataColor={NO_DATA[theme]}
            selected={selected}
            onSelect={setSelected}
            onHover={setHovered}
            ariaLabel="Map of Victorian local government areas coloured by the selected measure"
            className="h-[440px] md:h-[520px]"
            describe={(code, name) => {
              const r = byCode.get(code);
              if (!r) return { title: name, lines: ["No crime data"] };
              return {
                title: r.name,
                lines: [
                  `${fmtInt(r.total)} recorded offences (2019)`,
                  `Crime tweets: ${fmtInt(r.tweetsCrime)} · avg ${fmtScore(r.avgCrime)}`,
                  `All tweets: ${fmtInt(r.tweetsAll)} · avg ${fmtScore(r.avgAll)}`,
                  ...(r.kept ? [] : ["Removed by the IQR outlier rule"]),
                ],
              };
            }}
          />
          <div className="flex flex-wrap items-end justify-between gap-3">
            {mapMetric === "total" ? (
              <SequentialLegend
                label="Recorded offences, 2019 (quantile classes)"
                breaks={breaks}
                colors={SEQUENTIAL[theme]}
                format={fmtCompact}
              />
            ) : (
              <DivergingLegend
                mid={MID}
                spread={SPREAD}
                label={`Average sentiment of ${mapMetric === "crime" ? "crime" : "all"} tweets (1-9)`}
              />
            )}
            <NoDataSwatch
              color={NO_DATA[theme]}
              label={mapMetric === "total" ? "IQR outlier (hidden)" : "Below threshold / outlier"}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <ScatterPlot
              points={points}
              xType="log"
              xLabel="Recorded offences, 2019 (log scale)"
              yLabel={`Avg sentiment, ${yMetric === "crime" ? "crime tweets" : "all tweets"}`}
              xFormat={fmtCompact}
              yDomain={[0.8, 9.2]}
              fit={corr ? { slope: corr.slope, intercept: corr.intercept } : null}
              yReference={{ value: 5, label: "neutral (5)" }}
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
              onHover={setHovered}
              annotate={annotate}
              ariaLabel={
                corr
                  ? `Scatter plot of ${corr.n} LGAs: recorded offences against average sentiment of ${topic}. Pearson r ${corr.pearsonR.toFixed(2)}.`
                  : "Scatter plot with too few regions"
              }
              height={360}
            />
          </div>
          <CorrelationReadout c={corr} stored={storedMatch} />
          {corr && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {corr.n} LGAs with at least {minTweets} {minTweets === 1 ? topic.replace("tweets", "tweet") : topic}:{" "}
              {describeStrength(corr.pearsonR)} {corr.pearsonR >= 0 ? "positive" : "negative"} association (the fit line is
              linear in offences, drawn on a log axis).{" "}
              {yMetric === "crime" &&
                minTweets < 5 &&
                "Most LGAs have only a handful of crime tweets, so their averages swing between extremes; raise the threshold and the association disappears."}
            </p>
          )}
        </div>
      </div>

      <section aria-live="polite" className="rounded-lg border border-border bg-card p-5">
        {sel ? (
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr_1fr]">
            <div>
              <p className="kicker">Local government area</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold">{sel.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                LGA {sel.code} · {fmtInt(Math.round(sel.areaKm2))} km² · {sel.salCount} suburbs with tweets
              </p>
              <p className="num mt-3 font-serif text-3xl font-semibold">{fmtInt(sel.total)}</p>
              <p className="text-xs text-muted-foreground">
                recorded offences · #{rank.get(sel.code)} of {regions.length} LGAs
                {!sel.kept && " · removed by the IQR rule"}
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium text-muted-foreground">Offence divisions</h4>
              <ul className="space-y-1.5">
                {CRIME_CATEGORIES.map((c, i) => {
                  const v = sel.categories[c.key];
                  return (
                    <li key={c.key} className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-2 text-xs">
                      <span className="truncate text-muted-foreground">{c.label}</span>
                      <span className="h-2 rounded-full bg-muted" aria-hidden>
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(v / sel.total) * 100}%`, background: `var(--seq-${6 - i})` }}
                        />
                      </span>
                      <span className="num text-right">{fmtInt(v)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {(["crime", "all"] as const).map((m) => {
                const v = yOf(sel, m);
                return (
                  <div key={m}>
                    <dt className="text-muted-foreground">{m === "crime" ? "Crime tweets" : "All tweets"}</dt>
                    <dd className="num font-serif text-xl font-semibold">{fmtInt(wOf(sel, m))}</dd>
                    <dd className={cn("text-xs text-muted-foreground")}>
                      {v === null ? "no tweets" : `avg ${fmtScore(v)} · ${sentimentDescription(Math.round(v))}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select an LGA on the map or a dot in the chart (or search above) to see its offence mix and tweet sentiment.
          </p>
        )}
      </section>
    </div>
  );
}
