import type { Geometry } from "geojson";
import { toSvgPath } from "@/lib/geo-path";
import { divergingColor } from "@/lib/palette";
import type { SalRegion } from "@/lib/types";

/**
 * A server-rendered dot map: one circle per Victorian suburb with tweets,
 * placed at its representative point, sized by tweet volume and coloured by
 * average sentiment. Light and dark variants are both rendered and toggled
 * with CSS so no client JavaScript is needed.
 */
export function SuburbDots({
  regions,
  outline,
  className,
}: {
  regions: SalRegion[];
  /** Victoria's outline (lon/lat) drawn under the dots */
  outline?: Geometry;
  className?: string;
}) {
  const pts = regions.filter((r) => r.all);
  // equirectangular projection scaled by cos(lat) around Victoria's centre
  const lon0 = 140.9;
  const lon1 = 150.1;
  const lat0 = -39.25;
  const lat1 = -33.95;
  const k = Math.cos((-37 * Math.PI) / 180);
  const W = 640;
  const H = Math.round((W * (lat1 - lat0)) / ((lon1 - lon0) * k));
  const x = (lon: number) => ((lon - lon0) / (lon1 - lon0)) * W;
  const y = (lat: number) => ((lat1 - lat) / (lat1 - lat0)) * H;
  const maxN = Math.max(...pts.map((p) => p.all!.n));
  const r = (n: number) => 1.8 + Math.sqrt(n / maxN) * 22;
  const sorted = [...pts].sort((a, b) => b.all!.n - a.all!.n);
  const melb = pts.find((p) => p.name === "Melbourne");

  const dots = (theme: "light" | "dark") =>
    sorted.map((p) => (
      <circle
        key={p.code}
        cx={x(p.lon).toFixed(1)}
        cy={y(p.lat).toFixed(1)}
        r={r(p.all!.n).toFixed(2)}
        fill={divergingColor(p.all!.avg, 5.5, 1.6, theme)}
        fillOpacity={0.9}
        stroke={theme === "dark" ? "#111214" : "#f7f4ee"}
        strokeWidth={0.5}
      />
    ));

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Dot map of ${pts.length} Victorian suburbs. Each dot is a suburb sized by the number of geotagged tweets and coloured by average sentiment; Melbourne's CBD dominates.`}
      >
        {outline && (
          <path
            d={toSvgPath(outline, (p) => [x(p[0]), y(p[1])])}
            fill="var(--card)"
            stroke="var(--rule)"
            strokeWidth={1}
          />
        )}
        <g className="dark:hidden">{dots("light")}</g>
        <g className="hidden dark:inline">{dots("dark")}</g>
        {melb && (
          <g className="pointer-events-none">
            <line
              x1={x(melb.lon) + 8}
              y1={y(melb.lat) - 20}
              x2={x(melb.lon) + 60}
              y2={y(melb.lat) - 70}
              stroke="var(--foreground)"
              strokeOpacity={0.5}
            />
            <text x={x(melb.lon) + 64} y={y(melb.lat) - 74} className="fill-foreground font-sans text-[13px] font-semibold">
              Melbourne
            </text>
            <text x={x(melb.lon) + 64} y={y(melb.lat) - 58} className="num fill-muted-foreground font-sans text-[11px]">
              {melb.all!.n.toLocaleString("en-AU")} tweets
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}
