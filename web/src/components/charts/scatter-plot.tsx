"use client";

import { useMemo } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { extent, linearScale, logScale, logTicks, niceTicks } from "@/lib/scales";
import { cn } from "@/lib/utils";

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  /** weight (tweets) -> radius */
  n: number;
  label: string;
  color: string;
}

interface Props {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFormat: (v: number) => string;
  yFormat?: (v: number) => string;
  xType?: "linear" | "log";
  yDomain?: [number, number];
  /** least-squares line y = intercept + slope * x (x in data units, or log10(x) when logX) */
  fit?: { slope: number; intercept: number; logX?: boolean } | null;
  /** horizontal reference line, e.g. the neutral score 5 */
  yReference?: { value: number; label: string };
  selected?: string | null;
  hovered?: string | null;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  /** ids to label permanently */
  annotate?: string[];
  ariaLabel: string;
  height?: number;
  className?: string;
}

const M = { top: 16, right: 18, bottom: 46, left: 52 };

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xFormat,
  yFormat = (v) => v.toFixed(1),
  xType = "linear",
  yDomain,
  fit,
  yReference,
  selected,
  hovered,
  onSelect,
  onHover,
  annotate = [],
  ariaLabel,
  height = 380,
  className,
}: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>({ width: 640, height });
  const W = Math.max(280, width);
  const H = height;

  const { x, y, r, xTicks, yTicks } = useMemo(() => {
    const [x0, x1] = extent(points.map((p) => p.x));
    const [y0, y1] = yDomain ?? extent(points.map((p) => p.y));
    const xd: [number, number] =
      xType === "log" ? [Math.max(1, x0 * 0.85), x1 * 1.15] : [x0 - (x1 - x0) * 0.04, x1 + (x1 - x0) * 0.04];
    const yd: [number, number] = yDomain ?? [y0 - 0.3, y1 + 0.3];
    const xs = (xType === "log" ? logScale : linearScale)(xd, [M.left, W - M.right]);
    const ys = linearScale(yd, [H - M.bottom, M.top]);
    const nMax = Math.max(1, ...points.map((p) => p.n));
    const rs = (n: number) => 2.5 + Math.sqrt(n / nMax) * 11;
    const xt = xType === "log" ? logTicks(xd[0], xd[1]) : niceTicks(xd[0], xd[1], W < 480 ? 3 : 5);
    return { x: xs, y: ys, r: rs, xTicks: xt, yTicks: niceTicks(yd[0], yd[1], 5) };
  }, [points, W, H, xType, yDomain]);

  const fitPath = useMemo(() => {
    if (!fit) return null;
    const [a, b] = x.domain;
    const steps = 40;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const xv = xType === "log" ? 10 ** (Math.log10(a) + (Math.log10(b) - Math.log10(a)) * t) : a + (b - a) * t;
      const yv = fit.intercept + fit.slope * (fit.logX ? Math.log10(xv) : xv);
      if (yv < y.domain[0] || yv > y.domain[1]) continue;
      pts.push(`${x(xv).toFixed(1)},${y(yv).toFixed(1)}`);
    }
    return pts.length > 1 ? `M${pts.join("L")}` : null;
  }, [fit, x, y, xType]);

  // draw large circles first so small ones stay hoverable
  const ordered = useMemo(() => [...points].sort((p, q) => q.n - p.n), [points]);
  const focus = points.find((p) => p.id === (hovered ?? selected));
  const labelled = useMemo(() => {
    // naive collision avoidance: stack labels that would overlap vertically
    const items = points
      .filter((p) => annotate.includes(p.id) && p.id !== focus?.id)
      .map((p) => ({ p, lx: x(p.x) + r(p.n) + 4, ly: y(p.y) }))
      .sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      if (Math.abs(items[i].lx - prev.lx) < 90 && items[i].ly - prev.ly < 13) items[i].ly = prev.ly + 13;
    }
    return items;
  }, [points, annotate, focus, x, y, r]);

  return (
    <div ref={ref} className={cn("relative w-full select-none", className)}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={ariaLabel}
        className="block max-w-full overflow-visible"
        onMouseLeave={() => onHover?.(null)}
      >
        {/* grid */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-muted-foreground text-[11px]">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={M.top} y2={H - M.bottom} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={x(t)} y={H - M.bottom + 16} textAnchor="middle" className="num fill-muted-foreground text-[11px]">
              {xFormat(t)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--rule)" />
        <text x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[12px]">
          {xLabel}
        </text>
        <text
          transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-muted-foreground text-[12px]"
        >
          {yLabel}
        </text>

        {yReference && yReference.value > y.domain[0] && yReference.value < y.domain[1] && (
          <g>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(yReference.value)}
              y2={y(yReference.value)}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.6}
            />
            <text x={W - M.right - 4} y={y(yReference.value) - 5} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {yReference.label}
            </text>
          </g>
        )}

        {/* points */}
        <g>
          {ordered.map((p) => {
            const active = p.id === selected || p.id === hovered;
            return (
              <circle
                key={p.id}
                cx={x(p.x)}
                cy={y(p.y)}
                r={r(p.n)}
                fill={p.color}
                fillOpacity={active ? 1 : 0.78}
                stroke={active ? "var(--foreground)" : "var(--background)"}
                strokeWidth={active ? 2 : 0.8}
                className="cursor-pointer transition-[fill-opacity]"
                onMouseEnter={() => onHover?.(p.id)}
                onClick={() => onSelect?.(p.id === selected ? null : p.id)}
              />
            );
          })}
        </g>

        {fitPath && (
          <path d={fitPath} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />
        )}

        {labelled.map(({ p, lx, ly }) => (
          <text
            key={`l${p.id}`}
            x={lx}
            y={ly}
            dy="0.32em"
            className="pointer-events-none fill-foreground text-[11px] font-medium"
            style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 }}
          >
            {p.label}
          </text>
        ))}
      </svg>

      {focus && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: Math.min(x(focus.x) + 12, W - 190),
            top: Math.max(y(focus.y) - 44, 0),
          }}
        >
          <div className="font-semibold">{focus.label}</div>
          <div className="num text-muted-foreground">
            {xFormat(focus.x)} · {yFormat(focus.y)} · {focus.n.toLocaleString("en-AU")} tweets
          </div>
        </div>
      )}
    </div>
  );
}
