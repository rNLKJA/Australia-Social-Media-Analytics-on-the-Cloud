"use client";

import { useMemo, useRef, useState } from "react";
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
const px = (v: number) => Math.round(v * 10) / 10;
/** approximate rendered width of an 11px label */
const textW = (s: string) => s.length * 6.2;

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Log-axis ticks: the densest 1-2-5 / 1-3 / 1 set whose labels do not collide. */
function fitLogTicks(d: [number, number], x: (v: number) => number, fmt: (v: number) => string): number[] {
  const sets = [[1, 2, 5], [1, 3], [1]] as const;
  let last: number[] = [];
  for (const m of sets) {
    const ts = logTicks(d[0], d[1], m);
    if (!ts.length) continue;
    last = ts;
    let ok = true;
    for (let i = 1; i < ts.length && ok; i++) {
      const gap = x(ts[i]) - x(ts[i - 1]);
      ok = gap >= (textW(fmt(ts[i])) + textW(fmt(ts[i - 1]))) / 2 + 8;
    }
    if (ok && ts.length >= 2) return ts;
  }
  return last;
}

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
    const rawX = (xType === "log" ? logScale : linearScale)(xd, [M.left, W - M.right]);
    const rawY = linearScale(yd, [H - M.bottom, M.top]);
    // round to 0.1 px so server and browser Math (e.g. log10) produce identical markup
    const xs = Object.assign((v: number) => px(rawX(v)), { domain: rawX.domain, range: rawX.range });
    const ys = Object.assign((v: number) => px(rawY(v)), { domain: rawY.domain, range: rawY.range });
    const nMax = Math.max(1, ...points.map((p) => p.n));
    const rs = (n: number) => px(2.5 + Math.sqrt(n / nMax) * 11);
    const xt = xType === "log" ? fitLogTicks(xd, xs, xFormat) : niceTicks(xd[0], xd[1], W < 480 ? 3 : 5);
    return { x: xs, y: ys, r: rs, xTicks: xt, yTicks: niceTicks(yd[0], yd[1], 5) };
  }, [points, W, H, xType, yDomain, xFormat]);

  // fit line in pixel space (also used to keep labels off it)
  const fitPts = useMemo(() => {
    if (!fit) return [] as [number, number][];
    const [a, b] = x.domain;
    const steps = 40;
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const xv =
        xType === "log" ? 10 ** (Math.log10(a) + (Math.log10(b) - Math.log10(a)) * t) : a + (b - a) * t;
      const yv = fit.intercept + fit.slope * (fit.logX ? Math.log10(xv) : xv);
      if (yv < y.domain[0] || yv > y.domain[1]) continue;
      pts.push([x(xv), y(yv)]);
    }
    return pts;
  }, [fit, x, y, xType]);
  const fitPath =
    fitPts.length > 1 ? `M${fitPts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join("L")}` : null;
  const refVisible = !!yReference && yReference.value > y.domain[0] && yReference.value < y.domain[1];

  // keyboard-focused dot, and the dot that keeps the chart's single tab stop
  const [focused, setFocused] = useState<string | null>(null);
  const [kbId, setKbId] = useState<string | null>(null);

  // draw large circles first so small ones stay hoverable
  const ordered = useMemo(() => [...points].sort((p, q) => q.n - p.n), [points]);
  const focus = points.find((p) => p.id === (hovered ?? focused ?? selected));

  /**
   * Permanent labels, placed greedily in priority order (the `annotate` order):
   * right of the dot, then left, above, below. A label that would overlap an
   * earlier label, the reference-line caption or the fit line is dropped.
   */
  const labelled = useMemo(() => {
    const taken: Box[] = [];
    if (refVisible && yReference) {
      const ry = y(yReference.value) - 5;
      const x1 = W - M.right - 4;
      taken.push({ x0: x1 - yReference.label.length * 5.6, y0: ry - 10, x1, y1: ry + 2 });
    }
    const fitY = (px0: number): number | null => {
      for (let i = 1; i < fitPts.length; i++) {
        const [ax, ay] = fitPts[i - 1];
        const [bx, by] = fitPts[i];
        if (px0 >= ax && px0 <= bx) return ay + ((by - ay) * (px0 - ax)) / (bx - ax || 1);
      }
      return null;
    };
    const crossesFit = (b: Box) =>
      [b.x0, (b.x0 + b.x1) / 2, b.x1].some((xx) => {
        const fy = fitY(xx);
        return fy !== null && fy >= b.y0 - 1 && fy <= b.y1 + 1;
      });
    const inside = (b: Box) => b.x0 >= M.left && b.x1 <= W - M.right && b.y0 >= M.top && b.y1 <= H - M.bottom;
    const byId = new Map(points.map((p) => [p.id, p]));
    const out: { p: ScatterPoint; lx: number; ly: number; anchor: "start" | "end" | "middle" }[] = [];
    for (const id of annotate) {
      const p = byId.get(id);
      if (!p || p.id === focus?.id) continue;
      const cx = x(p.x);
      const cy = y(p.y);
      const rr = r(p.n);
      const w = textW(p.label);
      const h = 12;
      const options: { box: Box; lx: number; ly: number; anchor: "start" | "end" | "middle" }[] = [
        {
          box: { x0: cx + rr + 4, y0: cy - h / 2, x1: cx + rr + 4 + w, y1: cy + h / 2 },
          lx: cx + rr + 4,
          ly: cy,
          anchor: "start",
        },
        {
          box: { x0: cx - rr - 4 - w, y0: cy - h / 2, x1: cx - rr - 4, y1: cy + h / 2 },
          lx: cx - rr - 4,
          ly: cy,
          anchor: "end",
        },
        {
          box: { x0: cx - w / 2, y0: cy - rr - 3 - h, x1: cx + w / 2, y1: cy - rr - 3 },
          lx: cx,
          ly: cy - rr - 3 - h / 2,
          anchor: "middle",
        },
        {
          box: { x0: cx - w / 2, y0: cy + rr + 3, x1: cx + w / 2, y1: cy + rr + 3 + h },
          lx: cx,
          ly: cy + rr + 3 + h / 2,
          anchor: "middle",
        },
      ];
      const pick = options.find(
        (o) => inside(o.box) && !taken.some((t) => overlaps(t, o.box)) && !crossesFit(o.box),
      );
      if (!pick) continue;
      taken.push(pick.box);
      out.push({ p, lx: pick.lx, ly: pick.ly, anchor: pick.anchor });
    }
    return out;
  }, [points, annotate, focus, x, y, r, W, H, fitPts, refVisible, yReference]);

  // keyboard: one tab stop for the whole chart, arrow keys move along the x axis
  const kbOrder = useMemo(() => [...points].sort((p, q) => p.x - q.x || p.y - q.y), [points]);
  const circles = useRef(new Map<string, SVGCircleElement>());
  const tabStop =
    (kbId && points.some((p) => p.id === kbId) ? kbId : null) ??
    (selected && points.some((p) => p.id === selected) ? selected : null) ??
    kbOrder[0]?.id;
  const moveTo = (id: string | undefined) => {
    if (!id) return;
    setKbId(id);
    circles.current.get(id)?.focus();
  };
  const onKey = (e: React.KeyboardEvent, p: ScatterPoint) => {
    const i = kbOrder.findIndex((q) => q.id === p.id);
    if (e.key === "ArrowRight" || e.key === "ArrowUp")
      moveTo(kbOrder[Math.min(i + 1, kbOrder.length - 1)]?.id);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") moveTo(kbOrder[Math.max(i - 1, 0)]?.id);
    else if (e.key === "Home") moveTo(kbOrder[0]?.id);
    else if (e.key === "End") moveTo(kbOrder[kbOrder.length - 1]?.id);
    else if (e.key === "Enter" || e.key === " ") onSelect?.(p.id === selected ? null : p.id);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className={cn("relative w-full select-none", className)}>
      <svg
        width={W}
        height={H}
        role="group"
        aria-roledescription="scatter plot"
        aria-label={`${ariaLabel} Use the arrow keys to move between regions and Enter to select one.`}
        className="block max-w-full overflow-visible"
        onMouseLeave={() => onHover?.(null)}
      >
        {/* grid */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x={M.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="num fill-muted-foreground text-[11px]"
            >
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={M.top}
              y2={H - M.bottom}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x={x(t)}
              y={H - M.bottom + 16}
              textAnchor="middle"
              className="num fill-muted-foreground text-[11px]"
            >
              {xFormat(t)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="var(--rule)" />
        <text
          x={(M.left + W - M.right) / 2}
          y={H - 8}
          textAnchor="middle"
          className="fill-muted-foreground text-[12px]"
        >
          {xLabel}
        </text>
        <text
          transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-muted-foreground text-[12px]"
        >
          {yLabel}
        </text>

        {refVisible && yReference && (
          <g>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(yReference.value)}
              y2={y(yReference.value)}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.6}
            />
            <text
              x={W - M.right - 4}
              y={y(yReference.value) - 5}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {yReference.label}
            </text>
          </g>
        )}

        {/* points */}
        <g>
          {ordered.map((p) => {
            const active = p.id === selected || p.id === hovered || p.id === focused;
            return (
              <circle
                key={p.id}
                ref={(el) => {
                  if (el) circles.current.set(p.id, el);
                  else circles.current.delete(p.id);
                }}
                cx={x(p.x)}
                cy={y(p.y)}
                r={r(p.n)}
                fill={p.color}
                fillOpacity={active ? 1 : 0.78}
                stroke={active ? "var(--foreground)" : "var(--background)"}
                strokeWidth={active ? 2 : 0.8}
                className="cursor-pointer transition-[fill-opacity] focus-visible:outline-none"
                role="button"
                tabIndex={p.id === tabStop ? 0 : -1}
                aria-pressed={p.id === selected}
                aria-label={`${p.label}: ${xFormat(p.x)}, ${yFormat(p.y)}, ${p.n.toLocaleString("en-AU")} tweets`}
                onMouseEnter={() => onHover?.(p.id)}
                onClick={() => onSelect?.(p.id === selected ? null : p.id)}
                onFocus={() => {
                  setKbId(p.id);
                  setFocused(p.id);
                  onHover?.(p.id);
                }}
                onBlur={() => {
                  setFocused(null);
                  onHover?.(null);
                }}
                onKeyDown={(e) => onKey(e, p)}
              />
            );
          })}
        </g>

        {fitPath && (
          <path
            d={fitPath}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.85}
          />
        )}

        {labelled.map(({ p, lx, ly, anchor }) => (
          <text
            key={`l${p.id}`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dy="0.32em"
            className="fill-foreground pointer-events-none text-[11px] font-medium"
            style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 }}
          >
            {p.label}
          </text>
        ))}
      </svg>

      {focus && (
        <div
          className="border-border bg-popover pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 text-xs shadow-md"
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
