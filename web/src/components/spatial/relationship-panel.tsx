"use client";

import { useMemo, useState } from "react";
import { RelationshipFigures } from "@/components/spatial/relationship-figures";
import { analyseRelationship, type WeightsKind } from "@/lib/spatial-analysis";
import type { Adjacency, AreaRecord, SpatialUnit, Topic } from "@/lib/types";

const TOPIC_NAME: Record<Topic, string> = {
  all: "all tweets",
  income: "income tweets",
  crime: "crime tweets",
};

/** Scenario relationship with bootstrap and robust intervals, recomputed for the current settings. */
export function RelationshipPanel({
  unit,
  topic,
  minTweets,
  weights,
  areas,
  adjacency,
}: {
  unit: SpatialUnit;
  topic: Topic;
  minTweets: number;
  weights: WeightsKind;
  areas: AreaRecord[];
  adjacency: Adjacency;
}) {
  const [withOutliers, setWithOutliers] = useState(false);
  const res = useMemo(
    () =>
      analyseRelationship(unit, areas, adjacency, {
        topic,
        minTweets,
        weights,
        includeOutliers: withOutliers,
      }),
    [unit, areas, adjacency, topic, minTweets, weights, withOutliers],
  );
  return (
    <section className="border-border bg-card space-y-4 rounded-lg border p-5" aria-labelledby="rel-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="kicker">Scenario {unit === "sa2" ? "1" : "2"}, with uncertainty</p>
          <h3 id="rel-title" className="mt-1 font-serif text-2xl font-semibold">
            {unit === "sa2" ? "Median income" : "Recorded offences"} and the tone of {TOPIC_NAME[topic]}
          </h3>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={withOutliers}
            onChange={(e) => setWithOutliers(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Include the team&apos;s IQR outliers
        </label>
      </div>
      <RelationshipFigures res={res} />
    </section>
  );
}
