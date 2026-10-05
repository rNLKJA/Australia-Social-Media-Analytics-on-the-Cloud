"use client";

import dynamic from "next/dynamic";

/** MapLibre needs WebGL and `window`; load it only in the browser. */
export const LazyChoroplethMap = dynamic(() => import("./choropleth-map").then((m) => m.ChoroplethMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[440px] place-items-center rounded-lg border border-border bg-muted text-sm text-muted-foreground md:h-[520px]">
      <span className="animate-pulse">Loading map…</span>
    </div>
  ),
});
