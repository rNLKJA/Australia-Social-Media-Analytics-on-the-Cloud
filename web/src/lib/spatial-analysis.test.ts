import { describe, expect, it } from "vitest";
import fx from "@/lib/__fixtures__/stats-parity.json";
import { analyseRelationship, analyseSpatial, MIN_REGIONS } from "@/lib/spatial-analysis";
import { getAdjacency, getAreaRecords } from "@/server/spatial";

describe("analyseSpatial", () => {
  it("applies the small-area threshold and matches the PySAL reference", async () => {
    const [areas, adj] = await Promise.all([getAreaRecords("sa2"), getAdjacency("sa2")]);
    for (const c of fx.spatial.filter((s) => s.unit === "sa2")) {
      const res = analyseSpatial(areas, adj, {
        topic: "all",
        minTweets: c.minTweets,
        weights: c.weights as "knn6" | "rook",
      });
      expect(res.analysed).toBe(c.codes.length);
      expect(res.islands).toBe(c.islands.length);
      expect(res.moran!.I).toBeCloseTo(c.moran.I, 10);
      const withTweets = areas.filter((a) => (a.sums.all?.n ?? 0) > 0).length;
      expect(res.analysed + res.islands + res.suppressed).toBe(withTweets);
      expect(res.noTweets).toBe(areas.length - withTweets);
      const counted = Object.values(res.clusterCounts).reduce((a, b) => a + b, 0);
      expect(counted).toBe(res.analysed);
      // suppressed regions carry their n and interval but no LISA result
      for (const r of res.regions.filter((x) => x.status === "suppressed")) {
        expect(r.n).toBeLessThan(c.minTweets);
        expect(r.lisa).toBeUndefined();
      }
    }
  });

  it("is deterministic for a seed", async () => {
    const [areas, adj] = await Promise.all([getAreaRecords("lga"), getAdjacency("lga")]);
    const a = analyseSpatial(areas, adj, { topic: "all" });
    const b = analyseSpatial(areas, adj, { topic: "all" });
    expect(a).toEqual(b);
  });

  it("reports nothing when too few regions survive", async () => {
    const [areas, adj] = await Promise.all([getAreaRecords("lga"), getAdjacency("lga")]);
    const res = analyseSpatial(areas, adj, { topic: "crime", minTweets: 30 });
    expect(res.analysed).toBeLessThan(MIN_REGIONS);
    expect(res.moran).toBeNull();
  });
});

describe("analyseRelationship", () => {
  it("reproduces the statsmodels and scipy reference fits", async () => {
    const cases = [
      { name: "income_sa2_all_n30", unit: "sa2", topic: "all", minTweets: 30 },
      { name: "income_sa2_income_n1", unit: "sa2", topic: "income", minTweets: 1 },
      { name: "crime_lga_all_n30", unit: "lga", topic: "all", minTweets: 30 },
      { name: "crime_lga_crime_n1", unit: "lga", topic: "crime", minTweets: 1 },
    ] as const;
    for (const c of cases) {
      const [areas, adj] = await Promise.all([getAreaRecords(c.unit), getAdjacency(c.unit)]);
      const res = analyseRelationship(c.unit, areas, adj, { topic: c.topic, minTweets: c.minTweets });
      const ref = fx.ols.find((o) => o.name === c.name)!;
      const sp = fx.spearman.find((o) => o.name === c.name)!;
      expect(res.n).toBe(ref.x.length);
      expect(res.ols!.coef[1]).toBeCloseTo(ref.params[1], 10);
      expect(res.ols!.seHC3[1]).toBeCloseTo(ref.HC3[1], 10);
      expect(res.spearman!.estimate).toBeCloseTo(sp.rho, 12);
      expect(res.residualMoran).not.toBeNull();
    }
  });

  it("can bring back the IQR outliers", async () => {
    const [areas, adj] = await Promise.all([getAreaRecords("lga"), getAdjacency("lga")]);
    const kept = analyseRelationship("lga", areas, adj, { topic: "all", minTweets: 30 });
    const all = analyseRelationship("lga", areas, adj, {
      topic: "all",
      minTweets: 30,
      includeOutliers: true,
    });
    expect(all.n).toBeGreaterThan(kept.n);
  });
});
