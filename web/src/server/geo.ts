import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FeatureCollection, Geometry } from "geojson";
import { cache } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

/** Read a bundled TopoJSON file from public/geo at build/render time. */
export const readTopo = cache(
  async (file: string): Promise<FeatureCollection<Geometry, { name?: string }>> => {
    const topo = JSON.parse(
      await readFile(path.join(process.cwd(), "public", "geo", file), "utf8"),
    ) as Topology;
    const name = Object.keys(topo.objects)[0];
    return feature(topo, topo.objects[name] as GeometryCollection) as FeatureCollection<
      Geometry,
      { name?: string }
    >;
  },
);
