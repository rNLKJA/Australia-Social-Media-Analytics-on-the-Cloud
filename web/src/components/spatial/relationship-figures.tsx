import { fmtP } from "@/lib/format";
import type { RelationshipResult } from "@/lib/spatial-analysis";

/** Plain-language reading of a relationship's intervals. */
export function describeRelationship(res: RelationshipResult): string {
  if (!res.spearman || !res.ols) return "Too few areas pass this threshold to estimate the relationship.";
  const s = res.spearman;
  const lo = res.ols.ciHC3[1][0];
  const hi = res.ols.ciHC3[1][1];
  const crosses = s.lower <= 0 && s.upper >= 0;
  const weak = Math.abs(s.estimate) < 0.3;
  if (crosses)
    return `The interval for Spearman's rho runs from ${s.lower.toFixed(2)} to ${s.upper.toFixed(2)} and includes zero: the data are consistent with no association.`;
  return `Spearman's rho of ${s.estimate.toFixed(2)} (${s.lower.toFixed(2)} to ${s.upper.toFixed(2)}) excludes zero${weak ? ", but the association is weak" : ""}; the slope's robust interval runs from ${lo.toFixed(2)} to ${hi.toFixed(2)} points on the 1-9 scale.`;
}

export function RelationshipFigures({
  res,
  showNote = true,
}: {
  res: RelationshipResult;
  showNote?: boolean;
}) {
  const o = res.ols;
  const s = res.spearman;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["Areas", String(res.n), `≥ ${res.minTweets} tweets${res.includeOutliers ? ", outliers in" : ""}`],
          [
            "Spearman ρ",
            s ? s.estimate.toFixed(2) : "–",
            s ? `95% CI ${s.lower.toFixed(2)} to ${s.upper.toFixed(2)}` : "too few areas",
          ],
          [
            "OLS slope",
            o ? o.coef[1].toFixed(2) : "–",
            o ? `HC3 95% CI ${o.ciHC3[1][0].toFixed(2)} to ${o.ciHC3[1][1].toFixed(2)}` : "",
          ],
          [
            "p (HC3)",
            o ? fmtP(o.pHC3[1]).replace("p = ", "").replace("p < ", "< ") : "–",
            "robust, two-sided",
          ],
          [
            "R²",
            o ? o.r2.toFixed(3) : "–",
            o ? `SE ${o.se[1].toFixed(3)} classical vs ${o.seHC3[1].toFixed(3)} HC3` : "",
          ],
          [
            "Residual Moran's I",
            res.residualMoran ? res.residualMoran.I.toFixed(3) : "–",
            res.residualMoran ? `${fmtP(res.residualMoran.p_sim)} (permutation)` : "",
          ],
        ].map(([k, v, sub]) => (
          <div key={k} className="border-border rounded-md border px-3 py-2">
            <dt className="text-muted-foreground text-[11px]">{k}</dt>
            <dd className="num font-serif text-xl font-semibold">{v}</dd>
            <dd className="num text-muted-foreground text-[10px] leading-snug">{sub}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-relaxed">{describeRelationship(res)}</p>
      {showNote && <RelationshipNote res={res} />}
    </div>
  );
}

/** How the relationship figures were computed. */
export function RelationshipNote({ res }: { res: RelationshipResult }) {
  const s = res.spearman;
  return (
    <p className="text-muted-foreground text-xs leading-relaxed">
      Slope: change in average tone (1-9 scale){" "}
      {res.unit === "sa2" ? "per $10,000 of median income" : "per tenfold increase in recorded offences"}.
      Spearman interval: paired percentile bootstrap ({s ? s.B.toLocaleString("en-AU") : "2,000"} resamples,
      seed {s?.seed ?? 57}). Slope interval: HC3 heteroskedasticity-robust standard error with a normal
      reference. A residual Moran&apos;s I near zero means the areas&apos; spatial arrangement is not
      inflating the precision. Each combination of settings is a separate, exploratory comparison; none is
      corrected for the others.
    </p>
  );
}
