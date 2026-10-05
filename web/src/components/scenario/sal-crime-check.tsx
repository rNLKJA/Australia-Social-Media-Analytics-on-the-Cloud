"use client";

import { useState } from "react";
import { ScatterPlot } from "@/components/charts/scatter-plot";
import { useThemeName } from "@/hooks/use-theme-name";
import { fmtInt } from "@/lib/format";
import { divergingColor } from "@/lib/palette";

export interface SalCrimePoint {
  code: string;
  name: string;
  n: number;
  avg: number;
}

/** Report 6.3.2's suburb-level claim: more crime talk, more negative tone? */
export function SalCrimeCheck({
  points,
  fit,
}: {
  points: SalCrimePoint[];
  fit: { slope: number; intercept: number };
}) {
  const theme = useThemeName();
  const [hovered, setHovered] = useState<string | null>(null);
  const top = [...points].sort((a, b) => b.n - a.n).slice(0, 3).map((p) => p.code);
  return (
    <ScatterPlot
      points={points.map((p) => ({
        id: p.code,
        x: p.n,
        y: p.avg,
        n: p.n,
        label: p.name,
        color: divergingColor(p.avg, 5, 2, theme),
      }))}
      xType="log"
      xLabel="Crime-related tweets in the suburb (log scale)"
      yLabel="Avg sentiment of those tweets"
      xFormat={(v) => fmtInt(v)}
      yDomain={[0.8, 9.2]}
      fit={{ ...fit, logX: true }}
      yReference={{ value: 5, label: "neutral (5)" }}
      hovered={hovered}
      onHover={setHovered}
      annotate={top}
      ariaLabel={`Scatter plot of ${points.length} Victorian suburbs: number of crime tweets against their average sentiment. The fitted slope is close to zero.`}
      height={340}
    />
  );
}
