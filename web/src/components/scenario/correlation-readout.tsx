import { AlertTriangle, BadgeCheck } from "lucide-react";
import { fmtP, fmtR } from "@/lib/format";
import type { Correlation } from "@/lib/stats";
import type { StoredCorrelation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Below this many regions a p-value says little, so it is not shown. */
export const MIN_N_FOR_P = 8;
/** Below this many regions the readout carries a caution. */
export const CAUTION_N = 10;

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
      <p className={cn("text-muted-foreground text-sm", className)}>
        Too few regions at this threshold to estimate a correlation.
      </p>
    );
  }
  const showP = c.n >= MIN_N_FOR_P;
  const pText = (p: number) => (showP ? fmtP(p) : "p not shown");
  const agrees =
    stored &&
    stored.n === c.n &&
    Math.abs(stored.pearsonR - c.pearsonR) < 1e-9 &&
    Math.abs(stored.spearmanRho - c.spearmanRho) < 1e-9;
  return (
    <div className={cn("space-y-2", className)}>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Pearson r", fmtR(c.pearsonR), pText(c.pearsonP)],
          ["Spearman ρ", fmtR(c.spearmanRho), pText(c.spearmanP)],
          ["R²", c.r2.toFixed(3), "of variance"],
          ["Regions", String(c.n), "in the fit"],
        ].map(([k, v, sub]) => (
          <div key={k} className="border-border bg-card rounded-md border px-1.5 py-2">
            <dt className="text-muted-foreground text-[11px]">{k}</dt>
            <dd className="num font-serif text-xl font-semibold">{v}</dd>
            <dd className="num text-muted-foreground text-[10px]">{sub}</dd>
          </div>
        ))}
      </dl>
      {c.n < CAUTION_N && (
        <p className="text-sent-neg-ink flex items-start gap-1.5 text-[11px]">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          Only {c.n} regions pass this threshold: too few for a reliable estimate
          {showP ? ", so read these numbers with caution." : ", so p-values are not shown."}
        </p>
      )}
      {agrees && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <BadgeCheck className="text-sent-pos-ink size-3.5" aria-hidden />
          Computed in your browser; identical to the scipy values stored by the build script.
        </p>
      )}
    </div>
  );
}
