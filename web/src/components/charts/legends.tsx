import { cn } from "@/lib/utils";

/** Diverging legend for regional average sentiment (values on the 1-9 scale). */
export function DivergingLegend({
  mid,
  spread,
  label = "Average sentiment",
  className,
}: {
  mid: number;
  spread: number;
  label?: string;
  className?: string;
}) {
  const stops = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return (
    <div className={cn("w-full max-w-xs", className)}>
      <div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
        <span>{label}</span>
      </div>
      <div
        className="h-2.5 rounded-full"
        style={{
          background: `linear-gradient(to right, ${stops.map((s) => `var(--sent-${s})`).join(", ")})`,
        }}
        aria-hidden
      />
      <div className="num text-muted-foreground mt-1 flex justify-between text-[11px]">
        <span>≤ {(mid - spread).toFixed(1)} more negative</span>
        <span>{mid.toFixed(1)}</span>
        <span>more positive ≥ {(mid + spread).toFixed(1)}</span>
      </div>
    </div>
  );
}

/** Classed legend for a sequential (violet) scale. */
export function SequentialLegend({
  breaks,
  colors,
  format,
  label,
  className,
}: {
  breaks: number[];
  colors: string[];
  format: (v: number) => string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-sm", className)}>
      <div className="text-muted-foreground mb-1 text-[11px]">{label}</div>
      <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        {colors.map((c, i) => (
          <span key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="num text-muted-foreground relative mt-1 h-4 text-[11px]">
        {breaks.map((b, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2"
            style={{ left: `${((i + 1) / colors.length) * 100}%` }}
          >
            {format(b)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function NoDataSwatch({
  color,
  label = "No tweets / filtered out",
}: {
  color: string;
  label?: string;
}) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]">
      <span
        className="border-border inline-block size-2.5 rounded-sm border"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
