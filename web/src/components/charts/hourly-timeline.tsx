"use client";

import { useMemo, useState } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { fmtInt } from "@/lib/format";
import { labelEvery, linearScale, niceTicks } from "@/lib/scales";
import type { MastodonHour } from "@/lib/types";

const M = { top: 18, right: 46, bottom: 34, left: 48 };
const HOUR = 3600_000;

/**
 * Toots per UTC hour (bars) with the mean 1-9 score (line). Gaps in the
 * harvest are left visible rather than interpolated.
 */
export function HourlyTimeline({ hours, height = 300 }: { hours: MastodonHour[]; height?: number }) {
  const [ref, { width }] = useElementSize<HTMLDivElement>({ width: 900, height });
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(280, width);
  const H = height;

  const data = useMemo(
    () =>
      hours
        .map((h) => ({ ...h, t: Date.parse(h.hour), mean: h.toots ? h.scoreSum / h.toots : NaN }))
        .filter((h) => h.toots >= 1),
    [hours],
  );
  const t0 = Date.parse("2023-05-02T00:00:00Z");
  const t1 = Date.parse("2023-05-09T12:00:00Z");
  const x = linearScale([t0, t1], [M.left, W - M.right]);
  const maxN = Math.max(...data.map((d) => d.toots));
  const yN = linearScale([0, maxN * 1.08], [H - M.bottom, M.top]);
  const yS = linearScale([3.9, 5.6], [H - M.bottom, M.top]);
  const bw = Math.max(1, x(t0 + HOUR) - x(t0) - 1);
  const visible = data.filter((d) => d.t >= t0 && d.t <= t1);

  // mean line, broken across gaps longer than an hour; skip hours with < 50 toots
  const segments: string[] = [];
  let cur: string[] = [];
  let prevT = -Infinity;
  for (const d of visible) {
    if (d.toots < 50) continue;
    if (d.t - prevT > HOUR && cur.length) {
      segments.push(cur.join("L"));
      cur = [];
    }
    cur.push(`${(x(d.t) + bw / 2).toFixed(1)},${yS(d.mean).toFixed(1)}`);
    prevT = d.t;
  }
  if (cur.length) segments.push(cur.join("L"));

  const days = Array.from({ length: 8 }, (_, i) => t0 + i * 24 * HOUR);
  // a "9 May" label needs ~44 px; on phones label every other day (gridlines stay daily)
  const dayStep = labelEvery(x(t0 + 24 * HOUR) - x(t0), 44);
  const h = hover !== null ? visible[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Toots per hour and their mean sentiment on mastodon.social, 2 to 9 May 2023"
        className="block max-w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = e.clientX - rect.left;
          let best = -1;
          let bestD = Infinity;
          visible.forEach((d, i) => {
            const dd = Math.abs(x(d.t) + bw / 2 - px);
            if (dd < bestD) {
              bestD = dd;
              best = i;
            }
          });
          setHover(bestD < 12 ? best : null);
        }}
      >
        {niceTicks(0, maxN, 4).map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={yN(t)}
              y2={yN(t)}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
            <text
              x={M.left - 8}
              y={yN(t)}
              dy="0.32em"
              textAnchor="end"
              className="num fill-muted-foreground text-[11px]"
            >
              {fmtInt(t)}
            </text>
          </g>
        ))}
        {[4.0, 4.4, 4.8, 5.2].map((s) => (
          <text key={s} x={W - M.right + 8} y={yS(s)} dy="0.32em" className="num fill-sent-pos text-[11px]">
            {s.toFixed(1)}
          </text>
        ))}
        {days.map((d, i) => (
          <g key={d}>
            <line x1={x(d)} x2={x(d)} y1={M.top} y2={H - M.bottom} stroke="var(--rule)" strokeOpacity={0.5} />
            {i % dayStep === 0 && (
              <text x={x(d) + 4} y={H - M.bottom + 16} className="fill-muted-foreground text-[11px]">
                {new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}
              </text>
            )}
          </g>
        ))}
        {visible.map((d, i) => (
          <rect
            key={d.hour}
            x={x(d.t)}
            y={yN(d.toots)}
            width={bw}
            height={H - M.bottom - yN(d.toots)}
            fill="var(--seq-3)"
            opacity={hover === i ? 1 : 0.75}
          />
        ))}
        {segments.map((s, i) => (
          <path key={i} d={`M${s}`} fill="none" stroke="var(--sent-pos)" strokeWidth={2} />
        ))}
        <text x={M.left} y={10} className="fill-muted-foreground text-[11px]">
          Toots per hour (bars)
        </text>
        <text x={W - M.right + 40} y={10} textAnchor="end" className="fill-sent-pos text-[11px]">
          Mean score (line)
        </text>
        {h && (
          <line
            x1={x(h.t) + bw / 2}
            x2={x(h.t) + bw / 2}
            y1={M.top}
            y2={H - M.bottom}
            stroke="var(--foreground)"
            strokeOpacity={0.4}
          />
        )}
      </svg>
      {h && (
        <div
          className="border-border bg-popover pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(x(h.t) + 10, W - 200), top: 20 }}
        >
          <div className="font-semibold">
            {new Date(h.t).toLocaleString("en-AU", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "numeric",
              timeZone: "UTC",
            })}{" "}
            UTC
          </div>
          <div className="num text-muted-foreground">
            {fmtInt(h.toots)} toots · mean {h.mean.toFixed(2)} · {fmtInt(h.incomeToots)} income
          </div>
        </div>
      )}
    </div>
  );
}
