"use client";

import type { FeatureCollection, Geometry } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { VIC_BOUNDS } from "@/components/map/bounds";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useThemeName } from "@/hooks/use-theme-name";
import type { ThemeName } from "@/lib/palette";
import { cn } from "@/lib/utils";

// The worker is copied to public/ by tools/copy-maplibre-worker.mjs (pre-dev/pre-build).
maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

/** OpenFreeMap vector styles: free, no key, no account. */
const BASEMAP: Record<ThemeName, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

type RegionProps = { code: string; name: string };
type Regions = FeatureCollection<Geometry, RegionProps>;

const topoCache = new Map<string, Promise<FeatureCollection<Geometry, Record<string, unknown>>>>();

/** Fetch a TopoJSON file once per session and convert its first object to GeoJSON. */
export function loadTopo(url: string, object?: string) {
  const key = `${url}#${object ?? ""}`;
  let p = topoCache.get(key);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${url}`);
        return r.json() as Promise<Topology>;
      })
      .then((topo) => {
        const name = object ?? Object.keys(topo.objects)[0];
        return feature(topo, topo.objects[name] as GeometryCollection) as FeatureCollection<
          Geometry,
          Record<string, unknown>
        >;
      });
    topoCache.set(key, p);
    p.catch(() => topoCache.delete(key));
  }
  return p;
}

function fallbackStyle(theme: ThemeName): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": theme === "dark" ? "#15171a" : "#ece7dd" },
      },
    ],
  };
}

export interface ChoroplethMapProps {
  geoUrl: string;
  objectName: string;
  /** region code -> fill colour */
  fills: Record<string, string>;
  noDataColor: string;
  selected?: string | null;
  onSelect?: (code: string | null) => void;
  onHover?: (code: string | null) => void;
  /** tooltip text for a hovered region */
  describe?: (code: string, name: string) => { title: string; lines: string[] };
  bounds?: LngLatBoundsLike;
  /** zoom to this region when `selected` changes */
  flyToSelected?: boolean;
  ariaLabel: string;
  className?: string;
}

export function ChoroplethMap({
  geoUrl,
  objectName,
  fills,
  noDataColor,
  selected = null,
  onSelect,
  onHover,
  describe,
  bounds = VIC_BOUNDS,
  flyToSelected = true,
  ariaLabel,
  className,
}: ChoroplethMapProps) {
  const theme = useThemeName();
  const reducedMotion = usePrefersReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const dataRef = useRef<Regions | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback" | "error">("loading");
  const [tip, setTip] = useState<{ x: number; y: number; w: number; title: string; lines: string[] } | null>(
    null,
  );

  // keep latest callbacks/values in refs for the imperative map handlers
  const latest = useRef({ fills, noDataColor, selected, onSelect, onHover, describe, theme });
  useEffect(() => {
    latest.current = { fills, noDataColor, selected, onSelect, onHover, describe, theme };
  });

  // ---- create the map once ----------------------------------------------------
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let usedFallback = false;
    let hovered: string | null = null;

    const map = new maplibregl.Map({
      container: container.current,
      style: BASEMAP[latest.current.theme],
      bounds,
      fitBoundsOptions: { padding: 16 },
      attributionControl: { compact: true },
      cooperativeGestures: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 13,
      minZoom: 4,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    const addOverlay = async () => {
      if (cancelled) return;
      if (usedFallback && !map.getSource("states")) {
        try {
          const states = await loadTopo("/geo/aus-states.topo.json");
          if (cancelled) return;
          map.addSource("states", { type: "geojson", data: states });
          const dark = latest.current.theme === "dark";
          map.addLayer({
            id: "states-fill",
            type: "fill",
            source: "states",
            paint: { "fill-color": dark ? "#1d2024" : "#f6f2ea" },
          });
          map.addLayer({
            id: "states-line",
            type: "line",
            source: "states",
            paint: { "line-color": dark ? "#4a4f57" : "#b9ae9c", "line-width": 1 },
          });
        } catch {
          /* the regions still render on the plain background */
        }
      }
      const data = dataRef.current;
      if (!data || map.getSource("regions")) return;
      map.addSource("regions", { type: "geojson", data, promoteId: "code" });
      const firstSymbol = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      map.addLayer(
        {
          id: "regions-fill",
          type: "fill",
          source: "regions",
          paint: {
            "fill-color": ["coalesce", ["feature-state", "fill"], latest.current.noDataColor],
            "fill-opacity": 0.86,
          },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: "regions-line",
          type: "line",
          source: "regions",
          paint: {
            "line-color": latest.current.theme === "dark" ? "#0d0e10" : "#fffdf9",
            "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.2, 0.4],
            "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.7],
          },
        },
        firstSymbol,
      );
      map.addLayer({
        id: "regions-selected",
        type: "line",
        source: "regions",
        filter: ["==", ["get", "code"], latest.current.selected ?? ""],
        paint: { "line-color": latest.current.theme === "dark" ? "#f5f1e8" : "#1c1a17", "line-width": 2.4 },
      });
      applyFills(map, latest.current.fills);
      setReady(true);
      setStatus(usedFallback ? "fallback" : "ready");
    };

    const switchToFallback = () => {
      if (usedFallback || cancelled) return;
      usedFallback = true;
      map.setStyle(fallbackStyle(latest.current.theme), { diff: false });
    };
    const timeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) switchToFallback();
    }, 9000);

    map.on("style.load", () => {
      setReady(false);
      void addOverlay();
    });
    map.on("error", (e) => {
      // style or tile failures before the basemap is up -> local fallback basemap
      if (
        !map.getSource("regions") &&
        /style|Failed to fetch|NetworkError|AJAXError/i.test(String(e.error?.message ?? ""))
      ) {
        switchToFallback();
      }
    });

    loadTopo(geoUrl, objectName)
      .then((fc) => {
        if (cancelled) return;
        dataRef.current = fc as Regions;
        if (map.isStyleLoaded()) void addOverlay();
      })
      .catch(() => !cancelled && setStatus("error"));

    map.on("mousemove", "regions-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const code = String(f.properties?.code);
      if (hovered !== code) {
        if (hovered) map.setFeatureState({ source: "regions", id: hovered }, { hover: false });
        hovered = code;
        map.setFeatureState({ source: "regions", id: code }, { hover: true });
        latest.current.onHover?.(code);
      }
      map.getCanvas().style.cursor = "pointer";
      const d = latest.current.describe?.(code, String(f.properties?.name ?? code)) ?? {
        title: String(f.properties?.name ?? code),
        lines: [],
      };
      setTip({ x: e.point.x, y: e.point.y, w: map.getContainer().clientWidth, ...d });
    });
    map.on("mouseleave", "regions-fill", () => {
      if (hovered) map.setFeatureState({ source: "regions", id: hovered }, { hover: false });
      hovered = null;
      map.getCanvas().style.cursor = "";
      latest.current.onHover?.(null);
      setTip(null);
    });
    map.on("click", (e) => {
      const f = map.getLayer("regions-fill")
        ? map.queryRenderedFeatures(e.point, { layers: ["regions-fill"] })[0]
        : undefined;
      latest.current.onSelect?.(f ? String(f.properties?.code) : null);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoUrl, objectName]);

  // ---- theme switch: swap basemap, overlay is re-added on style.load ----------
  const firstTheme = useRef(theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || theme === firstTheme.current) return;
    firstTheme.current = theme;
    if (status === "fallback") {
      map.setStyle(fallbackStyle(theme), { diff: false });
    } else {
      map.setStyle(BASEMAP[theme], { diff: false });
    }
  }, [theme, status]);

  // ---- extent changes (e.g. Melbourne <-> Victoria) -----------------------------
  const boundsKey = JSON.stringify(bounds);
  const firstBounds = useRef(boundsKey);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || boundsKey === firstBounds.current) return;
    firstBounds.current = boundsKey;
    map.fitBounds(JSON.parse(boundsKey) as LngLatBoundsLike, {
      padding: 16,
      duration: reducedMotion ? 0 : 800,
    });
  }, [boundsKey, reducedMotion]);

  // ---- fills ---------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource("regions")) return;
    applyFills(map, fills);
    map.setPaintProperty("regions-fill", "fill-color", ["coalesce", ["feature-state", "fill"], noDataColor]);
  }, [fills, noDataColor, ready]);

  // ---- selection -----------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("regions-selected")) return;
    map.setFilter("regions-selected", ["==", ["get", "code"], selected ?? ""]);
    if (selected && flyToSelected && dataRef.current) {
      const f = dataRef.current.features.find((x) => x.properties.code === selected);
      if (f) {
        const b = bbox(f.geometry);
        if (b) {
          const current = map.getBounds();
          const inView =
            current.contains([b[0], b[1]]) && current.contains([b[2], b[3]]) && map.getZoom() > 6.5;
          if (!inView) map.fitBounds(b, { padding: 60, maxZoom: 10.5, duration: reducedMotion ? 0 : 900 });
        }
      }
    }
  }, [selected, ready, flyToSelected, reducedMotion]);

  return (
    <div
      className={cn("border-border bg-muted relative overflow-hidden rounded-lg border", className)}
      role="region"
      aria-label={ariaLabel}
    >
      {/* inline style: maplibre's unlayered CSS sets position: relative on this node */}
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      {status === "loading" && (
        <div className="text-muted-foreground pointer-events-none absolute inset-0 grid place-items-center text-sm">
          <span className="animate-pulse">Loading map…</span>
        </div>
      )}
      {status === "error" && (
        <div className="text-muted-foreground absolute inset-0 grid place-items-center p-6 text-center text-sm">
          The boundary file could not be loaded. The chart and table on this page still work.
        </div>
      )}
      {status === "fallback" && (
        <p className="bg-card/90 text-muted-foreground absolute bottom-2 left-2 rounded px-2 py-1 text-[11px] shadow-sm">
          Basemap tiles unavailable: showing bundled state outlines.
        </p>
      )}
      {tip && (
        <div
          className="border-border bg-popover text-popover-foreground pointer-events-none absolute z-10 max-w-60 rounded-md border px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.max(4, Math.min(tip.x + 14, tip.w - 250)),
            top: Math.max(tip.y - 10, 8),
          }}
        >
          <div className="font-semibold">{tip.title}</div>
          {tip.lines.map((l) => (
            <div key={l} className="num text-muted-foreground">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function applyFills(map: maplibregl.Map, fills: Record<string, string>) {
  const src = map.getSource("regions") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  map.removeFeatureState({ source: "regions" });
  for (const [code, fill] of Object.entries(fills)) {
    map.setFeatureState({ source: "regions", id: code }, { fill });
  }
}

function bbox(g: Geometry): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  if ("coordinates" in g) visit(g.coordinates);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}
