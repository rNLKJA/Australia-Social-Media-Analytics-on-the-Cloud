import { BadgeCheck } from "lucide-react";
import { fmtP, fmtR } from "@/lib/format";
import type { Correlation } from "@/lib/stats";
import type { StoredCorrelation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** r / rho / p / n readout, flagging agreement with the stored scipy result. */
export function CorrelationReadout({
  c,
  stored,
  className,
}: {
  c: Correlation | null;
  stored?: StoredCorrelation;
  className?: string;
}) {
  if (!c) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Too few regions at this threshold to estimate a correlation.
      </p>
    );
  }
  const agrees =
    stored &&
    stored.n === c.n &&
    Math.abs(stored.pearsonR - c.pearsonR) < 1e-9 &&
    Math.abs(stored.spearmanRho - c.spearmanRho) < 1e-9;
  return (
    <div className={cn("space-y-2", className)}>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Pearson r", fmtR(c.pearsonR), fmtP(c.pearsonP)],
          ["Spearman ρ", fmtR(c.spearmanRho), fmtP(c.spearmanP)],
          ["R²", c.r2.toFixed(3), "of variance"],
          ["Regions", String(c.n), "in the fit"],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-md border border-border bg-card px-1.5 py-2">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="num font-serif text-xl font-semibold">{v}</dd>
            <dd className="num text-[10px] text-muted-foreground">{sub}</dd>
          </div>
        ))}
      </dl>
      {agrees && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <BadgeCheck className="size-3.5 text-sent-pos" aria-hidden />
          Computed in your browser; identical to the scipy values stored by the build script.
        </p>
      )}
    </div>
  );
}
