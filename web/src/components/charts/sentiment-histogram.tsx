import { SENTIMENT_BUCKETS, sentimentDescription } from "@/lib/sentiment";
import { fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  counts: number[];
  /** optional second series drawn as outlined bars (shares are compared) */
  compare?: number[];
  compareLabel?: string;
  label: string;
  className?: string;
  /** show the share of each bucket above the bar */
  showValues?: boolean;
  compact?: boolean;
}

/**
 * The team's 1-9 sentiment distribution as a diverging-coloured histogram.
 * Server-rendered SVG with an accessible data table.
 */
export function SentimentHistogram({
  counts,
  compare,
  compareLabel,
  label,
  className,
  showValues = true,
  compact = false,
}: Props) {
  const total = counts.reduce((a, b) => a + b, 0);
  const shares = counts.map((c) => (total ? c / total : 0));
  const cTotal = compare?.reduce((a, b) => a + b, 0) ?? 0;
  const cShares = compare?.map((c) => (cTotal ? c / cTotal : 0));
  const max = Math.max(...shares, ...(cShares ?? [0]), 0.01);
  const W = 360;
  const H = compact ? 150 : 200;
  const top = showValues ? 18 : 6;
  const bottom = compact ? 22 : 34;
  const bw = W / 9;
  const y = (s: number) => top + (1 - s / max) * (H - top - bottom);
  const mode = shares.indexOf(Math.max(...shares));

  return (
    <figure className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={label}>
        <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--rule)" />
        {shares.map((s, i) => {
          const x = i * bw + 3;
          const h = H - bottom - y(s);
          return (
            <g key={i}>
              <rect x={x} y={y(s)} width={bw - 6} height={Math.max(h, s > 0 ? 1 : 0)} rx={2} fill={`var(--sent-${i + 1})`}>
                <title>{`${i + 1} · ${sentimentDescription(i + 1)}: ${fmtInt(counts[i])} (${fmtPct(s, 1)})`}</title>
              </rect>
              {cShares && (
                <rect
                  x={x + 1}
                  y={y(cShares[i])}
                  width={bw - 8}
                  height={Math.max(H - bottom - y(cShares[i]), 0)}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity={0.75}
                  strokeDasharray="3 2"
                  rx={2}
                />
              )}
              {showValues && s >= 0.005 && (
                <text
                  x={x + (bw - 6) / 2}
                  y={y(s) - 5}
                  textAnchor="middle"
                  className={cn("num fill-muted-foreground text-[9px]", i === mode && "fill-foreground font-semibold")}
                >
                  {fmtPct(s, s < 0.1 ? 1 : 0)}
                </text>
              )}
              <text x={x + (bw - 6) / 2} y={H - bottom + 13} textAnchor="middle" className="num fill-muted-foreground text-[10px]">
                {i + 1}
              </text>
            </g>
          );
        })}
        {!compact && (
          <>
            <text x={2} y={H - 4} className="fill-sent-neg text-[9px] font-semibold tracking-wider uppercase">
              ← Negative
            </text>
            <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[9px] tracking-wider uppercase">
              Neutral
            </text>
            <text x={W - 2} y={H - 4} textAnchor="end" className="fill-sent-pos text-[9px] font-semibold tracking-wider uppercase">
              Positive →
            </text>
          </>
        )}
      </svg>
      {compare && compareLabel && (
        <figcaption className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-4 rounded-[2px] border border-dashed border-foreground/70" aria-hidden />
          {compareLabel}
        </figcaption>
      )}
      <div className="sr-only">
      <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Score</th>
            <th scope="col">Count</th>
            <th scope="col">Share</th>
            {compare && <th scope="col">{compareLabel ?? "Comparison"} share</th>}
          </tr>
        </thead>
        <tbody>
          {SENTIMENT_BUCKETS.map((b, i) => (
            <tr key={b}>
              <th scope="row">
                {b} ({sentimentDescription(b)})
              </th>
              <td>{counts[i]}</td>
              <td>{fmtPct(shares[i], 1)}</td>
              {cShares && <td>{fmtPct(cShares[i], 1)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
