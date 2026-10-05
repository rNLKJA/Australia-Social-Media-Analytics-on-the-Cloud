"use client";

import dynamic from "next/dynamic";

/** MapLibre needs WebGL and `window`; load it only in the browser. */
export const LazyChoroplethMap = dynamic(() => import("./choropleth-map").then((m) => m.ChoroplethMap), {
  ssr: false,
  loading: () => (
    <div className="border-border bg-muted text-muted-foreground grid h-[440px] place-items-center rounded-lg border text-sm md:h-[520px]">
      <span className="animate-pulse">Loading map…</span>
    </div>
  ),
});
