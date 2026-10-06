"use client";

import { AlertTriangle } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { NoDataSwatch } from "@/components/charts/legends";
import { ScatterPlot, type ScatterPoint } from "@/components/charts/scatter-plot";
import { MELB_BOUNDS, VIC_BOUNDS } from "@/components/map/bounds";
import { LazyChoroplethMap as ChoroplethMap, MAP_BOX } from "@/components/map/lazy-map";
import { RegionSearch } from "@/components/scenario/region-search";
import { Segmented } from "@/components/scenario/segmented";
import { ThresholdControl } from "@/components/scenario/threshold-control";
import { RelationshipPanel } from "@/components/spatial/relationship-panel";
import { useThemeName } from "@/hooks/use-theme-name";
import { fmtInt, fmtP, fmtScore } from "@/lib/format";
import { NO_DATA, SENTIMENT, type ThemeName } from "@/lib/palette";
import {
  analyseSpatial,
  type RegionStat,
  SPATIAL_DEFAULTS,
  WEIGHTS_LABEL,
  type WeightsKind,
} from "@/lib/spatial-analysis";
import { type ClusterLabel, reliability, tweetsForReliability, varianceComponents } from "@/lib/stats";
import type { Adjacency, AreaRecord, SpatialUnit, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CLUSTER_LABEL: Record<ClusterLabel, string> = {
  HH: "High-High: positive area among positive neighbours",
  LL: "Low-Low: negative area among negative neighbours",
  HL: "High-Low outlier: more positive than its neighbours",
  LH: "Low-High outlier: more negative than its neighbours",
  ns: "Not significant",
};

const SHORT: Record<ClusterLabel, string> = {
  HH: "High-High",
  LL: "Low-Low",
  HL: "High-Low",
  LH: "Low-High",
  ns: "Not significant",
};

export function clusterColor(c: ClusterLabel, theme: ThemeName): string {
  const s = SENTIMENT[theme];
  return { HH: s[8], LL: s[0], HL: s[6], LH: s[2], ns: s[4] }[c];
}

const TOPICS: Record<SpatialUnit, { value: Topic; label: string }[]> = {
  sa2: [
    { value: "all", label: "All tweets" },
    { value: "income", label: "Income tweets" },
  ],
  lga: [
    { value: "all", label: "All tweets" },
    { value: "crime", label: "Crime tweets" },
  ],
};

export function SpatialExplorer({
  areas,
  adjacency,
}: {
  areas: Record<SpatialUnit, AreaRecord[]>;
  adjacency: Record<SpatialUnit, Adjacency>;
}) {
  const theme = useThemeName();
  const [unit, setUnit] = useState<SpatialUnit>("sa2");
  const [topic, setTopic] = useState<Topic>("all");
  const [minTweets, setMinTweets] = useState<number>(SPATIAL_DEFAULTS.minTweets);
  const [weights, setWeights] = useState<WeightsKind>(SPATIAL_DEFAULTS.weights);
  const [fdr, setFdr] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"vic" | "melb">("vic");

  // recompute in a deferred render so the controls stay responsive
  const dUnit = useDeferredValue(unit);
  const dTopic = useDeferredValue(topic);
  const dMin = useDeferredValue(minTweets);
  const dWeights = useDeferredValue(weights);
  const dFdr = useDeferredValue(fdr);
  const opts = useMemo(
    () => ({ unit: dUnit, topic: dTopic, minTweets: dMin, weights: dWeights, fdr: dFdr }),
    [dUnit, dTopic, dMin, dWeights, dFdr],
  );
  const stale =
    dMin !== minTweets || dUnit !== unit || dTopic !== topic || dWeights !== weights || dFdr !== fdr;

  const res = useMemo(
    () =>
      analyseSpatial(areas[opts.unit], adjacency[opts.unit], {
        topic: opts.topic,
        minTweets: opts.minTweets,
        weights: opts.weights,
        fdr: opts.fdr,
      }),
    [areas, adjacency, opts],
  );
  const vc = useMemo(
    () => varianceComponents(areas[opts.unit].map((a) => a.sums[opts.topic]).filter((s) => s !== undefined)),
    [areas, opts.unit, opts.topic],
  );
  const byCode = useMemo(() => new Map(res.regions.map((r) => [r.code, r])), [res]);

  const fills = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of res.regions) if (r.lisa) out[r.code] = clusterColor(r.lisa.cluster, theme);
    return out;
  }, [res, theme]);

  const points: ScatterPoint[] = useMemo(
    () =>
      res.regions
        .filter((r) => r.lisa)
        .map((r) => ({
          id: r.code,
          x: r.lisa!.z,
          y: r.lisa!.lag,
          n: r.n,
          label: r.name,
          color: clusterColor(r.lisa!.cluster, theme),
        })),
    [res, theme],
  );
  const lagMean = points.length ? points.reduce((a, p) => a + p.y, 0) / points.length : 0;
  const ext = Math.max(2.5, ...points.map((p) => Math.abs(p.y)));

  const sel = selected ? byCode.get(selected) : undefined;
  const nFor50 = tweetsForReliability(0.5, vc);
  const tableRows = [...res.regions].filter((r) => r.status !== "no-tweets").sort((a, b) => b.n - a.n);
  const unitName = opts.unit === "sa2" ? "SA2" : "LGA";

  return (
    <div className="space-y-6">
      {/* controls */}
      <div className="border-border bg-card grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-[auto_auto_minmax(12rem,1fr)_auto_minmax(12rem,1fr)] xl:items-start">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Areas</span>
          <Segmented
            label="Area unit"
            value={unit}
            onChange={(u) => {
              setUnit(u);
              setTopic("all");
              setSelected(null);
            }}
            options={[
              { value: "sa2", label: `SA2 (${areas.sa2.length})` },
              { value: "lga", label: `LGA (${areas.lga.length})` },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Sentiment of</span>
          <Segmented label="Topic" value={topic} onChange={setTopic} options={TOPICS[unit]} />
        </div>
        <ThresholdControl
          value={minTweets}
          onChange={setMinTweets}
          max={200}
          label="Minimum tweets (smaller areas suppressed)"
        />
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Neighbours</span>
          <Segmented
            label="Spatial weights"
            value={weights}
            onChange={setWeights}
            options={[
              { value: "knn6", label: "6 nearest" },
              { value: "rook", label: "Shared border" },
            ]}
          />
          <label className="flex items-center gap-2 pt-1 text-xs">
            <input
              type="checkbox"
              checked={fdr}
              onChange={(e) => setFdr(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Control the false discovery rate
          </label>
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Find</span>
          <RegionSearch
            placeholder={`An ${unitName}, e.g. ${unit === "sa2" ? "Southbank" : "Ballarat"}`}
            emptyLabel={`No ${unitName} matches`}
            items={areas[unit].map((a) => ({
              code: a.code,
              name: a.name,
              hint: fmtInt(a.sums[topic]?.n ?? 0),
            }))}
            onPick={setSelected}
          />
        </div>
      </div>

      {/* Moran's I readout */}
      <div
        className={cn(
          "border-border bg-card grid gap-4 rounded-lg border p-4 transition-opacity md:grid-cols-[1.1fr_1fr]",
          stale && "opacity-60",
        )}
        aria-live="polite"
        aria-busy={stale}
      >
        <div>
          <p className="kicker">Global Moran&apos;s I</p>
          {res.moran ? (
            <>
              <p className="mt-1 font-serif text-3xl font-semibold">
                I = <span className="num">{res.moran.I.toFixed(3)}</span>
                <span className="text-muted-foreground num ml-2 text-base font-normal">
                  (expected if random: {res.moran.EI.toFixed(3)})
                </span>
              </p>
              <p className="text-muted-foreground num mt-1 text-sm">
                permutation {fmtP(res.moran.p_sim)} (one-sided, {fmtInt(res.permutations)} permutations, seed{" "}
                {res.seed}) · normal approximation {fmtP(res.moran.p_norm)} (two-sided) · z ={" "}
                {res.moran.z_norm.toFixed(2)}
              </p>
              <p className="mt-3 text-sm leading-relaxed">
                {res.moran.p_sim < 0.05 && res.moran.I > res.moran.EI
                  ? `Neighbouring ${unitName}s are more alike in tone than chance would produce.`
                  : "No evidence that neighbouring areas are more alike in tone than chance would produce."}{" "}
                {res.moran.I < 0.1 && "Even where significant, a value this small means weak clustering."}
              </p>
            </>
          ) : (
            <p className="text-sent-neg-ink mt-2 flex items-start gap-1.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Only {res.analysed} {unitName}s pass this threshold: too few for a spatial statistic.
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 md:grid-cols-2">
          {[
            ["Analysed", fmtInt(res.analysed), `≥ ${opts.minTweets} tweets`],
            ["Suppressed", fmtInt(res.suppressed), `< ${opts.minTweets} tweets`],
            ["No tweets", fmtInt(res.noTweets), "left out"],
            ["Islands", fmtInt(res.islands), WEIGHTS_LABEL[opts.weights].toLowerCase()],
          ].map(([k, v, sub]) => (
            <div key={k} className="border-border rounded-md border px-3 py-2">
              <dt className="text-muted-foreground text-[11px]">{k}</dt>
              <dd className="num font-serif text-xl font-semibold">{v}</dd>
              <dd className="text-muted-foreground text-[10px]">{sub}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* map + Moran scatter */}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 space-y-3">
          <ChoroplethMap
            geoUrl={opts.unit === "sa2" ? "/geo/vic-sa2.topo.json" : "/geo/vic-lga.topo.json"}
            objectName={opts.unit}
            fills={fills}
            noDataColor={NO_DATA[theme]}
            selected={selected}
            onSelect={setSelected}
            onHover={setHovered}
            bounds={view === "melb" ? MELB_BOUNDS : VIC_BOUNDS}
            ariaLabel={`LISA cluster map of Victorian ${unitName}s`}
            className={MAP_BOX.regular}
            describe={(code, name) => {
              const r = byCode.get(code);
              if (!r || r.status === "no-tweets") return { title: name, lines: ["No tweets"] };
              const lines = [`${fmtInt(r.n)} tweets · mean ${fmtScore(r.mean)}`];
              if (r.lower !== null) lines.push(`95% CI ${fmtScore(r.lower)}–${fmtScore(r.upper)}`);
              if (r.status === "suppressed") lines.push(`Suppressed: under ${opts.minTweets} tweets`);
              if (r.status === "island") lines.push("No analysed neighbour (island)");
              if (r.lisa) lines.push(`${SHORT[r.lisa.cluster]} · p = ${r.lisa.p.toFixed(3)}`);
              return { title: r.name, lines };
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Most analysed {unitName}s are in Melbourne.</span>
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
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]" aria-label="Map legend">
            {(["HH", "LL", "HL", "LH", "ns"] as const).map((c) => (
              <li key={c} className="text-muted-foreground inline-flex items-center gap-1.5">
                <span
                  className="border-border inline-block size-3 rounded-sm border"
                  style={{ background: clusterColor(c, theme) }}
                  aria-hidden
                />
                {SHORT[c]} <span className="num">({res.clusterCounts[c]})</span>
              </li>
            ))}
            <li>
              <NoDataSwatch color={NO_DATA[theme]} label="Suppressed, island or no tweets" />
            </li>
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Local Moran&apos;s I with conditional permutation ({fmtInt(res.permutations)} draws, seed{" "}
            {res.seed}), two-sided pseudo p &lt; {res.alpha}
            {res.fdr
              ? ", Benjamini-Hochberg adjusted across all analysed areas"
              : ", not adjusted for multiple testing"}
            . With {res.analysed} tests at 5%, about {Math.round(res.analysed * 0.05)}{" "}
            &ldquo;significant&rdquo; areas are expected by chance alone.
          </p>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="border-border bg-card rounded-lg border p-3">
            <ScatterPlot
              points={points}
              xLabel="Area's tone (standardised)"
              yLabel="Neighbours' average (lag)"
              xFormat={(v) => v.toFixed(1)}
              yDomain={[-ext, ext]}
              fit={res.moran ? { slope: res.moran.I, intercept: lagMean } : null}
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
              onHover={setHovered}
              annotate={[...points]
                .sort((a, b) => b.n - a.n)
                .slice(0, 3)
                .map((p) => p.id)}
              ariaLabel={`Moran scatter plot of ${points.length} ${unitName}s: each area's standardised tone against its neighbours' average. Slope ${res.moran?.I.toFixed(3) ?? "not computed"}.`}
              height={340}
            />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            The slope of the dashed line is Moran&apos;s I. Points top-right and bottom-left are areas that
            resemble their neighbours; dot size shows how many tweets an area&apos;s average rests on.
          </p>
        </div>
      </div>

      {/* selected region */}
      <section aria-live="polite" className="border-border bg-card rounded-lg border p-5">
        {sel ? (
          <RegionDetail r={sel} unitName={unitName} vc={vc} minTweets={opts.minTweets} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Select an area on the map or in the plot to see its sample size, interval and local statistic.
          </p>
        )}
      </section>

      {/* signal vs noise */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="border-border bg-card min-w-0 space-y-3 rounded-lg border p-4">
          <p className="kicker">Signal or noise?</p>
          <p className="text-sm leading-relaxed">
            Individual tweet scores in a {unitName} vary with a standard deviation of{" "}
            <strong className="num">{Math.sqrt(vc.withinVar).toFixed(2)}</strong> points, while the true{" "}
            {unitName} averages differ by about{" "}
            <strong className="num">{Math.sqrt(vc.betweenVar).toFixed(2)}</strong> (method-of-moments estimate
            across {vc.k} areas). An average needs about{" "}
            <strong className="num">{Number.isFinite(nFor50) ? fmtInt(Math.ceil(nFor50)) : "∞"}</strong>{" "}
            tweets before half of its variation is real difference rather than sampling noise.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Tweets are treated as independent; prolific accounts make the effective sample smaller, so these
            are optimistic. The suppression threshold (default {SPATIAL_DEFAULTS.minTweets}) is explained in
            decision record DR-003.
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          <div className="border-border bg-card relative max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <caption className="sr-only">Per-area sample sizes and intervals</caption>
              <thead className="bg-muted/80 text-muted-foreground sticky top-0 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {unitName}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Tweets
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Mean [95% CI]
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Reliability
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? tableRows : tableRows.slice(0, 12)).map((r) => (
                  <tr
                    key={r.code}
                    className={cn("border-border/60 border-t", r.code === selected && "bg-primary/5")}
                  >
                    <td className="max-w-[12rem] truncate px-3 py-1.5">
                      <button
                        type="button"
                        className="hover:text-primary text-left"
                        onClick={() => setSelected(r.code)}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="num px-3 py-1.5 text-right">{fmtInt(r.n)}</td>
                    <td className="num px-3 py-1.5 text-right whitespace-nowrap">
                      {fmtScore(r.mean)}
                      {r.lower !== null && (
                        <span className="text-muted-foreground">
                          {" "}
                          [{fmtScore(r.lower)}, {fmtScore(r.upper)}]
                        </span>
                      )}
                    </td>
                    <td className="num px-3 py-1.5 text-right">{reliability(r.n, vc).toFixed(2)}</td>
                    <td className="px-3 py-1.5">
                      <StatusTag r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="link text-xs" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show the 12 largest" : `Show all ${tableRows.length} areas with tweets`}
          </button>
        </div>
      </div>

      <RelationshipPanel
        unit={opts.unit}
        topic={opts.topic}
        minTweets={opts.minTweets}
        weights={opts.weights}
        areas={areas[opts.unit]}
        adjacency={adjacency[opts.unit]}
      />
    </div>
  );
}

function StatusTag({ r }: { r: RegionStat }) {
  if (r.status === "analysed")
    return r.lisa && r.lisa.cluster !== "ns" ? (
      <span className="font-medium">{SHORT[r.lisa.cluster]}</span>
    ) : (
      <span className="text-muted-foreground">analysed</span>
    );
  if (r.status === "suppressed") return <span className="text-sent-neg-ink">suppressed</span>;
  if (r.status === "island") return <span className="text-muted-foreground">island</span>;
  return <span className="text-muted-foreground">no tweets</span>;
}

function RegionDetail({
  r,
  unitName,
  vc,
  minTweets,
}: {
  r: RegionStat;
  unitName: string;
  vc: { withinVar: number; betweenVar: number };
  minTweets: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
      <div>
        <p className="kicker">{unitName}</p>
        <h3 className="mt-1 font-serif text-2xl font-semibold">{r.name}</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {r.status === "suppressed"
            ? `Suppressed: ${fmtInt(r.n)} tweets is under the ${minTweets}-tweet threshold, so it is left out of the statistics.`
            : r.status === "island"
              ? "Analysed, but no neighbouring area passes the threshold, so it has no spatial lag."
              : r.status === "no-tweets"
                ? "No geotagged tweets were matched here."
                : r.lisa
                  ? CLUSTER_LABEL[r.lisa.cluster]
                  : ""}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Tweets</dt>
          <dd className="num font-serif text-xl font-semibold">{fmtInt(r.n)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mean (1-9)</dt>
          <dd className="num font-serif text-xl font-semibold">{fmtScore(r.mean)}</dd>
          <dd className="num text-muted-foreground text-xs">
            {r.lower !== null
              ? `95% CI ${fmtScore(r.lower)}–${fmtScore(r.upper)}`
              : "no interval from one tweet"}
          </dd>
        </div>
      </dl>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Reliability</dt>
          <dd className="num font-serif text-xl font-semibold">{reliability(r.n, vc).toFixed(2)}</dd>
          <dd className="text-muted-foreground text-xs">share of signal</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Local I</dt>
          <dd className="num font-serif text-xl font-semibold">{r.lisa ? r.lisa.Is.toFixed(2) : "–"}</dd>
          <dd className="num text-muted-foreground text-xs">
            {r.lisa ? `p = ${r.lisa.p.toFixed(3)}` : "not computed"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
