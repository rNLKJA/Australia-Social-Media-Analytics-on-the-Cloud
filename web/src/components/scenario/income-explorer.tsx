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
import { fmtAud, fmtAudK, fmtInt, fmtScore } from "@/lib/format";
import { median } from "@/lib/pandas";
import { NO_DATA, SEQUENTIAL, divergingColor, quantileBreaks, sequentialColor } from "@/lib/palette";
import { sentimentDescription } from "@/lib/sentiment";
import { correlate, describeStrength } from "@/lib/stats";
import type { IncomeRegion, StoredCorrelation } from "@/lib/types";

type MapMetric = "median" | "income" | "all";
type YMetric = "income" | "all";

export function IncomeExplorer({
  regions,
  stored,
}: {
  regions: IncomeRegion[];
  stored: StoredCorrelation[];
}) {
  const theme = useThemeName();
  const [mapMetric, setMapMetric] = useState<MapMetric>("median");
  const [yMetric, setYMetric] = useState<YMetric>("income");
  const [minTweets, setMinTweets] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const kept = useMemo(() => regions.filter((r) => r.kept), [regions]);
  const byCode = useMemo(() => new Map(regions.map((r) => [r.code, r])), [regions]);
  const vicMedian = useMemo(() => median(kept.map((r) => r.medianAud)), [kept]);
  const breaks = useMemo(
    () =>
      quantileBreaks(
        kept.map((r) => r.medianAud),
        7,
      ),
    [kept],
  );
  const rankByMedian = useMemo(() => {
    const sorted = [...kept].sort((a, b) => b.medianAud - a.medianAud);
    return new Map(sorted.map((r, i) => [r.code, i + 1]));
  }, [kept]);

  const yOf = (r: IncomeRegion, m: YMetric) => (m === "income" ? r.avgIncome : r.avgAll);
  const wOf = (r: IncomeRegion, m: YMetric) => (m === "income" ? r.tweetsIncome : r.tweetsAll);

  const fills = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of kept) {
      if (mapMetric === "median") out[r.code] = sequentialColor(r.medianAud, breaks, theme);
      else {
        const v = yOf(r, mapMetric);
        if (v !== null && wOf(r, mapMetric) >= minTweets) out[r.code] = divergingColor(v, 5.4, 1.4, theme);
      }
    }
    return out;
  }, [kept, mapMetric, breaks, theme, minTweets]);

  const fitRegions = useMemo(
    () => kept.filter((r) => yOf(r, yMetric) !== null && wOf(r, yMetric) >= minTweets),
    [kept, yMetric, minTweets],
  );
  const corr = useMemo(
    () =>
      correlate(
        fitRegions.map((r) => r.medianAud),
        fitRegions.map((r) => yOf(r, yMetric) as number),
      ),
    [fitRegions, yMetric],
  );
  const storedMatch = stored.find(
    (s) =>
      s.unit === "sa2" &&
      s.yMetric === (yMetric === "income" ? "avg_income" : "avg_all") &&
      s.minTweets === minTweets,
  );

  const points: ScatterPoint[] = useMemo(
    () =>
      fitRegions.map((r) => {
        const yv = yOf(r, yMetric) as number;
        return {
          id: r.code,
          x: r.medianAud,
          y: yv,
          n: wOf(r, yMetric),
          label: r.name,
          color: divergingColor(yv, 5.4, 1.4, theme),
        };
      }),
    [fitRegions, yMetric, theme],
  );

  const sel = selected ? byCode.get(selected) : undefined;
  const annotate = useMemo(() => {
    const top = [...fitRegions].sort((a, b) => wOf(b, yMetric) - wOf(a, yMetric)).slice(0, 3);
    return top.map((r) => r.code);
  }, [fitRegions, yMetric]);

  const topicLabel = yMetric === "income" ? "income-related tweets" : "all geotagged tweets";

  return (
    <div className="space-y-6">
      {/* controls */}
      <div className="border-border bg-card grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-[auto_auto_minmax(11rem,1fr)_minmax(13rem,1fr)] xl:items-start">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Map shows</span>
          <Segmented
            label="Map metric"
            value={mapMetric}
            onChange={setMapMetric}
            options={[
              { value: "median", label: "Median income" },
              { value: "income", label: "Income-tweet mood" },
              { value: "all", label: "All-tweet mood" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Chart: income vs</span>
          <Segmented
            label="Sentiment measure"
            value={yMetric}
            onChange={setYMetric}
            options={[
              { value: "income", label: "Income tweets" },
              { value: "all", label: "All tweets" },
            ]}
          />
        </div>
        <ThresholdControl value={minTweets} onChange={setMinTweets} />
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Find</span>
          <RegionSearch
            placeholder="An SA2, e.g. Sydenham"
            items={kept.map((r) => ({ code: r.code, name: r.name, hint: fmtAudK(r.medianAud) }))}
            onPick={setSelected}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* map */}
        <div className="space-y-3">
          <ChoroplethMap
            geoUrl="/geo/vic-sa2.topo.json"
            objectName="sa2"
            fills={fills}
            noDataColor={NO_DATA[theme]}
            selected={selected}
            onSelect={setSelected}
            onHover={setHovered}
            ariaLabel="Map of Victorian SA2 regions coloured by the selected measure"
            className="h-[440px] md:h-[520px]"
            describe={(code, name) => {
              const r = byCode.get(code);
              if (!r) return { title: name, lines: ["No income data"] };
              if (!r.kept)
                return {
                  title: r.name,
                  lines: [`${fmtAud(r.medianAud)} median`, "Removed by the IQR outlier rule"],
                };
              return {
                title: r.name,
                lines: [
                  `${fmtAud(r.medianAud)} median income`,
                  `Income tweets: ${fmtInt(r.tweetsIncome)} · avg ${fmtScore(r.avgIncome)}`,
                  `All tweets: ${fmtInt(r.tweetsAll)} · avg ${fmtScore(r.avgAll)}`,
                ],
              };
            }}
          />
          <div className="flex flex-wrap items-end justify-between gap-3">
            {mapMetric === "median" ? (
              <SequentialLegend
                label="Median personal income, 2015-16 (quantile classes)"
                breaks={breaks}
                colors={SEQUENTIAL[theme]}
                format={fmtAudK}
              />
            ) : (
              <DivergingLegend
                mid={5.4}
                spread={1.4}
                label={`Average sentiment of ${mapMetric === "income" ? "income" : "all"} tweets (1-9)`}
              />
            )}
            <NoDataSwatch
              color={NO_DATA[theme]}
              label={mapMetric === "median" ? "IQR outlier / no data" : "Below tweet threshold"}
            />
          </div>
        </div>

        {/* scatter + stats */}
        <div className="space-y-4">
          <div className="border-border bg-card rounded-lg border p-3">
            <ScatterPlot
              points={points}
              xLabel="Median personal income (AUD)"
              yLabel={`Avg sentiment, ${yMetric === "income" ? "income tweets" : "all tweets"}`}
              xFormat={fmtAudK}
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
                  ? `Scatter plot of ${corr.n} SA2s: median income against average sentiment of ${topicLabel}. Pearson r ${corr.pearsonR.toFixed(2)}.`
                  : "Scatter plot with too few regions"
              }
              height={360}
            />
          </div>
          <CorrelationReadout c={corr} stored={storedMatch} />
          {corr && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              With at least {minTweets} {minTweets === 1 ? topicLabel.replace("tweets", "tweet") : topicLabel}{" "}
              per SA2, income explains{" "}
              <strong className="text-foreground">{(corr.r2 * 100).toFixed(1)}%</strong> of the variation in
              average sentiment: {describeStrength(corr.pearsonR)}{" "}
              {corr.pearsonR >= 0 ? "positive" : "negative"} association.
              {Math.abs(corr.pearsonR) < 0.3 &&
                " Wealthier areas do not tweet noticeably happier, which matches the team's 2023 conclusion."}
            </p>
          )}
        </div>
      </div>

      {/* detail */}
      <section aria-live="polite" className="border-border bg-card rounded-lg border p-5">
        {sel ? (
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <p className="kicker">{sel.sa4}</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold">{sel.name}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                SA2 {sel.code} · {sel.sa3} · pooled from {sel.salCount} suburb{sel.salCount === 1 ? "" : "s"}{" "}
                with tweets
              </p>
              {!sel.kept && (
                <p className="text-sent-neg mt-2 text-sm">
                  Removed by the team&apos;s IQR outlier rule, so it is not in the chart or the fit.
                </p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Median income</dt>
                <dd className="num font-serif text-xl font-semibold">{fmtAud(sel.medianAud)}</dd>
                <dd className="text-muted-foreground text-xs">
                  {sel.kept
                    ? `#${rankByMedian.get(sel.code)} of ${kept.length}; ${sel.medianAud >= vicMedian ? "above" : "below"} the VIC median`
                    : "outlier"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mean income</dt>
                <dd className="num font-serif text-xl font-semibold">{fmtAud(sel.meanAud)}</dd>
              </div>
            </dl>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {(["income", "all"] as const).map((m) => {
                const v = yOf(sel, m);
                return (
                  <div key={m}>
                    <dt className="text-muted-foreground">
                      {m === "income" ? "Income tweets" : "All tweets"}
                    </dt>
                    <dd className="num font-serif text-xl font-semibold">{fmtInt(wOf(sel, m))}</dd>
                    <dd className="text-muted-foreground text-xs">
                      {v === null
                        ? "no tweets"
                        : `avg ${fmtScore(v)} · nearest bucket: ${sentimentDescription(Math.round(v))}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Select an area on the map or a dot in the chart (or search above) to see its income and tweet
            sentiment.
          </p>
        )}
      </section>
    </div>
  );
}
