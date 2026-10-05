import type { Metadata } from "next";
import Link from "next/link";
import { AreaCaveats } from "@/components/editorial/caveats";
import { Note, PageHeader, Section, StatStrip } from "@/components/editorial/page-header";
import { SpatialExplorer } from "@/components/spatial/spatial-explorer";
import { fmtInt, fmtP } from "@/lib/format";
import { SITE } from "@/lib/site";
import {
  analyseRelationship,
  analyseSpatial,
  SPATIAL_DEFAULTS,
  type WeightsKind,
} from "@/lib/spatial-analysis";
import { tweetsForReliability, varianceComponents } from "@/lib/stats";
import type { SpatialUnit } from "@/lib/types";
import { getAdjacency, getAreaRecords } from "@/server/spatial";

export const metadata: Metadata = {
  title: "Spatial statistics",
  description:
    "Global and local Moran's I for regional tweet sentiment in Victoria, with permutation tests, small-area suppression, bootstrap and robust intervals for the income and crime scenarios, and a sensitivity table.",
};

const THRESHOLDS = [1, 10, 30, 100];
const WEIGHTS: WeightsKind[] = ["knn6", "rook"];

export default async function SpatialPage() {
  const [sa2, lga, adjSa2, adjLga] = await Promise.all([
    getAreaRecords("sa2"),
    getAreaRecords("lga"),
    getAdjacency("sa2"),
    getAdjacency("lga"),
  ]);
  const areas = { sa2, lga };
  const adjacency = { sa2: adjSa2, lga: adjLga };

  const main = analyseSpatial(sa2, adjSa2, { topic: "all" });
  const loose = analyseSpatial(sa2, adjSa2, { topic: "all", minTweets: 1 });
  const vc = varianceComponents(sa2.map((a) => a.sums.all).filter((s) => s !== undefined));
  const nHalf = Math.ceil(tweetsForReliability(0.5, vc));

  const sensitivity = (["sa2", "lga"] as SpatialUnit[]).flatMap((unit) =>
    THRESHOLDS.flatMap((minTweets) =>
      WEIGHTS.map((weights) => {
        const r = analyseSpatial(areas[unit], adjacency[unit], { topic: "all", minTweets, weights });
        return { unit, minTweets, weights, n: r.analysed, islands: r.islands, moran: r.moran };
      }),
    ),
  );
  const relRows = [
    ...[1, 10, 30, 100].map((k) => ({
      label: "Income vs all tweets (SA2)",
      r: analyseRelationship("sa2", sa2, adjSa2, { topic: "all", minTweets: k }),
    })),
    ...[1, 10, 30].map((k) => ({
      label: "Income vs income tweets (SA2)",
      r: analyseRelationship("sa2", sa2, adjSa2, { topic: "income", minTweets: k }),
    })),
    ...[1, 10, 30, 100].map((k) => ({
      label: "Offences vs all tweets (LGA)",
      r: analyseRelationship("lga", lga, adjLga, { topic: "all", minTweets: k }),
    })),
    ...[1, 5, 10].map((k) => ({
      label: "Offences vs crime tweets (LGA)",
      r: analyseRelationship("lga", lga, adjLga, { topic: "crime", minTweets: k }),
    })),
  ];

  const excludingMap = new Map<string, number[]>();
  for (const { label, r } of relRows)
    if (r.spearman && (r.spearman.lower > 0 || r.spearman.upper < 0))
      excludingMap.set(label, [...(excludingMap.get(label) ?? []), r.minTweets]);
  const excluding = [...excludingMap.entries()];
  const noneEverywhere = excluding.every(
    ([label, ks]) => ks.length < relRows.filter((x) => x.label === label).length,
  );
  const allWeak = relRows.every(
    ({ r }) =>
      !r.spearman || (r.spearman.lower <= 0 && r.spearman.upper >= 0) || Math.abs(r.spearman.estimate) < 0.3,
  );

  return (
    <>
      <PageHeader
        kicker="2026 upgrade · spatial statistics"
        title="Is the mood clustered in space, or is it noise?"
        lede={
          <>
            Maps of regional averages invite the eye to find patterns. This page tests for them: global and
            local Moran&apos;s I with permutation inference, a minimum sample size before an area counts, and
            intervals on the two scenario relationships.
          </>
        }
      >
        <StatStrip
          stats={[
            {
              value: main.moran ? main.moran.I.toFixed(3) : "–",
              label: `Moran's I, SA2s with ≥ ${SPATIAL_DEFAULTS.minTweets} tweets`,
              note: main.moran ? `${main.analysed} SA2s · ${fmtP(main.moran.p_sim)}` : "",
            },
            {
              value: loose.moran ? loose.moran.I.toFixed(3) : "–",
              label: "Same, counting every SA2 with a tweet",
              note: loose.moran ? `${loose.analysed} SA2s · ${fmtP(loose.moran.p_sim)}` : "",
            },
            {
              value: `${Math.sqrt(vc.betweenVar).toFixed(2)} vs ${Math.sqrt(vc.withinVar).toFixed(2)}`,
              label: "Spread of true SA2 means vs single tweets",
              note: "points on the 1-9 scale",
            },
            {
              value: fmtInt(nHalf),
              label: "Tweets an SA2 needs to be half signal",
              note: `${sa2.filter((a) => (a.sums.all?.n ?? 0) >= nHalf).length} of ${sa2.filter((a) => a.sums.all).length} SA2s get there`,
            },
          ]}
        />
      </PageHeader>

      <Section
        kicker="Explore"
        title="Clusters, outliers and how much each area's average can bear"
        intro={
          <p>
            Areas below the tweet threshold are suppressed: hatched on the map and left out of every
            statistic. Raise it and watch the &ldquo;pattern&rdquo; at low thresholds fade. Everything
            recomputes in your browser with the same seed as the server, so the numbers are reproducible.
          </p>
        }
      >
        <SpatialExplorer areas={areas} adjacency={adjacency} />
      </Section>

      <Section
        id="sensitivity"
        kicker="Sensitivity"
        title="How much the answer depends on the choices"
        intro={
          <p>
            The same tweets, analysed with different minimum sample sizes, neighbour definitions and area
            units. A finding that only appears under one combination is not a finding.
          </p>
        }
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="border-border bg-card relative overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="text-muted-foreground px-4 pt-3 text-left text-xs">
                Global Moran&apos;s I of average tone (all tweets); permutation p,{" "}
                {SPATIAL_DEFAULTS.permutations} permutations, seed {SPATIAL_DEFAULTS.seed}
              </caption>
              <thead className="text-muted-foreground text-left text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Areas
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Min tweets
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Neighbours
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    n
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    I
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    p
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {sensitivity.map((s) => (
                  <tr
                    key={`${s.unit}${s.minTweets}${s.weights}`}
                    className="border-border/60 border-b last:border-0"
                  >
                    <td className="px-4 py-1.5">{s.unit.toUpperCase()}</td>
                    <td className="px-4 py-1.5 whitespace-nowrap">≥ {s.minTweets}</td>
                    <td className="px-4 py-1.5">
                      {s.weights === "knn6"
                        ? "6 nearest"
                        : `border${s.islands ? ` (${s.islands} islands)` : ""}`}
                    </td>
                    <td className="px-4 py-1.5 text-right">{s.n}</td>
                    <td className="px-4 py-1.5 text-right">{s.moran ? s.moran.I.toFixed(3) : "–"}</td>
                    <td className="px-4 py-1.5 text-right">
                      {s.moran ? fmtP(s.moran.p_sim).replace("p = ", "").replace("p < ", "< ") : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-border bg-card relative overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="text-muted-foreground px-4 pt-3 text-left text-xs">
                Scenario relationships (team&apos;s IQR outliers removed): Spearman&apos;s ρ with a 95%
                bootstrap interval, and the residual Moran&apos;s I of the OLS fit
              </caption>
              <thead className="text-muted-foreground text-left text-xs">
                <tr className="border-border border-b">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Comparison
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Min
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    n
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    ρ [95% CI]
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Resid. I
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {relRows.map(({ label, r }) => (
                  <tr key={`${label}${r.minTweets}`} className="border-border/60 border-b last:border-0">
                    <td className="px-4 py-1.5">{label}</td>
                    <td className="px-4 py-1.5 whitespace-nowrap">≥ {r.minTweets}</td>
                    <td className="px-4 py-1.5 text-right">{r.n}</td>
                    <td className="px-4 py-1.5 text-right whitespace-nowrap">
                      {r.spearman
                        ? `${r.spearman.estimate.toFixed(2)} [${r.spearman.lower.toFixed(2)}, ${r.spearman.upper.toFixed(2)}]`
                        : "too few"}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      {r.residualMoran ? r.residualMoran.I.toFixed(3) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Note className="mt-4 max-w-3xl">
          These are many looks at one dataset and no correction for multiple comparisons is applied, so an
          interval that excludes zero is a lead to check, not a result.{" "}
          {excluding.length
            ? `Intervals excluding zero: ${excluding.map(([label, ks]) => `${label.toLowerCase()} at ${ks.map((k) => `≥ ${k}`).join(" and ")} tweets`).join("; ")}.${noneEverywhere ? " None holds at every threshold." : ""}${allWeak ? " All are weak (ρ under 0.3)." : ""}`
            : "No interval excludes zero."}{" "}
          The 2023 conclusions stand: no meaningful link between income and the tone of income tweets, and
          none between recorded offences and the tone of crime tweets.
        </Note>
      </Section>

      <Section kicker="Read this first" title="What these statistics can and cannot say">
        <AreaCaveats unit="area" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="border-border bg-card rounded-lg border p-4 text-sm">
            <p className="font-semibold">Small areas</p>
            <p className="text-muted-foreground mt-1.5 leading-relaxed">
              Most SA2s have a handful of geotagged tweets, and an average of five tweets can swing by two
              points on its own. Areas under {SPATIAL_DEFAULTS.minTweets} tweets are suppressed by default (
              <Link className="link" href="/methods/decisions/DR-003-small-area-suppression">
                DR-003
              </Link>
              ); the scenario pages keep the 2023 thresholds but now show each area&apos;s sample size and
              interval.
            </p>
          </div>
          <div className="border-border bg-card rounded-lg border p-4 text-sm">
            <p className="font-semibold">Verified, not just computed</p>
            <p className="text-muted-foreground mt-1.5 leading-relaxed">
              The TypeScript statistics are checked in CI against PySAL (libpysal, esda), statsmodels and
              scipy: neighbour sets identical, Moran&apos;s I and its moments to 1e-9, local statistics to
              1e-10, and permutation p-values within Monte Carlo error. See{" "}
              <a className="link" href={`${SITE.repo}/blob/main/scripts/verify_stats.py`}>
                scripts/verify_stats.py
              </a>{" "}
              and the{" "}
              <Link className="link" href="/methods#evaluation">
                methods page
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
