import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { neighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Adjacency, AreaRecord, SpatialUnit, Topic } from "@/lib/types";
import { query } from "./db";

const UNIT_SQL: Record<SpatialUnit, { salCol: string; regions: string; covariates: string }> = {
  sa2: {
    salCol: "sa2_code16",
    regions: "SELECT sa2_code AS code, name, lat, lon FROM regions_sa2 ORDER BY sa2_code",
    covariates:
      "SELECT sa2_code AS code, median_aud AS covariate, vic_iqr_kept AS kept FROM scenario_income_sa2",
  },
  lga: {
    salCol: "lga_code19",
    regions: "SELECT lga_code AS code, name, lat, lon FROM regions_lga ORDER BY lga_code",
    covariates: "SELECT lga_code AS code, total AS covariate, iqr_kept AS kept FROM scenario_crime_lga",
  },
};

/**
 * Victorian SA2s or LGAs with the CouchDB `_stats` sums of their suburbs'
 * tweets pooled per topic (count, sum and sum of squared scores), plus the
 * scenario covariate (median income or recorded offences).
 */
export const getAreaRecords = cache(async (unit: SpatialUnit): Promise<AreaRecord[]> => {
  const u = UNIT_SQL[unit];
  const [regions, covs, sums] = await Promise.all([
    query<{ code: string; name: string; lat: number; lon: number }>(u.regions),
    query<{ code: string; covariate: number; kept: number }>(u.covariates),
    query<{ code: string; topic: Topic; n: number; s: number; ss: number }>(
      `SELECT r.${u.salCol} AS code, t.topic, SUM(t.tweet_count) AS n, SUM(t.score_sum) AS s,
              SUM(t.score_sumsqr) AS ss
         FROM twitter_sal_sentiment t JOIN regions_sal r USING (sal_code)
        WHERE r.${u.salCol} IS NOT NULL
        GROUP BY r.${u.salCol}, t.topic`,
    ),
  ]);
  const covBy = new Map(covs.map((c) => [c.code, c]));
  const sumsBy = new Map<string, AreaRecord["sums"]>();
  for (const s of sums) {
    const m = sumsBy.get(s.code) ?? {};
    m[s.topic] = { n: s.n, sum: s.s, sumsq: s.ss };
    sumsBy.set(s.code, m);
  }
  return regions.map((r) => {
    const c = covBy.get(r.code);
    return {
      code: r.code,
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      sums: sumsBy.get(r.code) ?? {},
      covariate: c?.covariate ?? null,
      kept: c ? c.kept === 1 : null,
    };
  });
});

const TOPO_FILE: Record<SpatialUnit, string> = { sa2: "vic-sa2.topo.json", lga: "vic-lga.topo.json" };

/**
 * Rook contiguity read from the bundled TopoJSON: two regions are neighbours
 * when they share an arc (a stretch of border). Matches libpysal's
 * `Rook.from_dataframe` on the same file exactly (see stats-parity.test.ts).
 */
export const getAdjacency = cache(async (unit: SpatialUnit): Promise<Adjacency> => {
  const topo = JSON.parse(
    await readFile(path.join(process.cwd(), "public", "geo", TOPO_FILE[unit]), "utf8"),
  ) as Topology;
  const obj = topo.objects[Object.keys(topo.objects)[0]] as GeometryCollection<{ code: string }>;
  const geoms = obj.geometries;
  const nb = neighbors(geoms);
  const out: Adjacency = {};
  const codeOf = (i: number) => String((geoms[i].properties as { code: string }).code);
  geoms.forEach((_, i) => {
    out[codeOf(i)] = nb[i].map(codeOf).sort();
  });
  return out;
});
