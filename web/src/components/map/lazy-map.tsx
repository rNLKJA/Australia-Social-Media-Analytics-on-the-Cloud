"use client";

import dynamic from "next/dynamic";
import type { ChoroplethMapProps } from "./choropleth-map";
import { cn } from "@/lib/utils";

/** MapLibre needs WebGL and `window`; load it only in the browser. */
const ChoroplethMap = dynamic(() => import("./choropleth-map").then((m) => m.ChoroplethMap), {
  ssr: false,
  loading: () => (
    <div className="border-border bg-muted text-muted-foreground grid h-full place-items-center rounded-lg border text-sm">
      <span className="animate-pulse">Loading map…</span>
    </div>
  ),
});

/**
 * Sized wrapper: `className` sets the box (the same while loading and once the
 * map is up, so nothing shifts) and the map fills it.
 */
export function LazyChoroplethMap({ className, ...props }: ChoroplethMapProps) {
  return (
    <div className={cn("relative", className)}>
      <ChoroplethMap {...props} className="h-full" />
    </div>
  );
}

/**
 * Map box sizes: on phones a 4:3 box that fits Victoria's wide extent and
 * leaves room to scroll past; fixed heights from the `sm` breakpoint.
 */
export const MAP_BOX = {
  tall: "aspect-[4/3] sm:aspect-auto sm:h-[480px] md:h-[600px]",
  regular: "aspect-[4/3] sm:aspect-auto sm:h-[440px] md:h-[520px]",
} as const;
