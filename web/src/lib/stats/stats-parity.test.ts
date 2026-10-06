import { describe, expect, it } from "vitest";
import pd from "@/lib/__fixtures__/paired-diff-parity.json";
import fx from "@/lib/__fixtures__/stats-parity.json";
import { buildWeights } from "@/lib/spatial-analysis";
import type { Adjacency } from "@/lib/types";
import { getAdjacency, getAreaRecords } from "@/server/spatial";
import { spearmanBootstrap } from "./bootstrap";
import { pearson, rankdata } from "./correlation";
import { benjaminiHochberg, mcnemarExact, pairedDifferenceScoreCi } from "./multiple";
import { wilson } from "./proportion";
import { ols } from "./regression";
import { areaMean, varianceComponents } from "./reliability";
import { localMoran, moran } from "./spatial";
import { normalCdf, normalQuantile, normalSf, studentTCdf, studentTQuantile } from "./special";

/**
 * Every expected value here was computed by scripts/verify_stats.py with
 * scipy, statsmodels and PySAL (versions recorded in the fixture). Analytic
 * quantities must agree to near machine precision; permutation and bootstrap
 * quantities use different random streams, so they must agree within Monte
 * Carlo error.
 */

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

describe("distributions (scipy.stats)", () => {
  it("normal cdf and sf", () => {
    for (const [x, v] of fx.normalCdf) expect(rel(normalCdf(x), v)).toBeLessThan(1e-12);
    for (const [x, v] of fx.normalSf) expect(rel(normalSf(x), v)).toBeLessThan(1e-12);
  });
  it("normal quantile", () => {
    for (const [p, v] of fx.normalPpf) expect(normalQuantile(p)).toBeCloseTo(v, 12);
  });
  it("Student t cdf and quantile", () => {
    for (const [t, df, v] of fx.tCdf) expect(studentTCdf(t, df)).toBeCloseTo(v, 12);
    for (const [p, df, v] of fx.tPpf) expect(rel(studentTQuantile(p, df), v)).toBeLessThan(1e-10);
  });
});

describe("intervals and tests (statsmodels)", () => {
  it("Wilson score interval", () => {
    for (const [k, n, lo, hi] of fx.wilson) {
      const w = wilson(k, n);
      expect(w.lower).toBeCloseTo(lo, 12);
      expect(w.upper).toBeCloseTo(hi, 12);
    }
  });
  it("exact McNemar test", () => {
    for (const [b, c, p] of fx.mcnemar) expect(mcnemarExact(b, c).p).toBeCloseTo(p, 12);
  });
  it("Tango score interval for a paired difference (R PropCIs::scoreci.mp)", () => {
    // PropCIs stops its search at a step of 1e-7, so agreement is to about 1e-7
    expect(pd.cases.length).toBeGreaterThan(20);
    for (const [onlyA, onlyB, n, level, lo, hi] of pd.cases) {
      const ci = pairedDifferenceScoreCi(onlyA, onlyB, n, level);
      expect(ci.estimate).toBeCloseTo((onlyA - onlyB) / n, 14);
      expect(Math.abs(ci.lower - lo)).toBeLessThan(5e-7);
      expect(Math.abs(ci.upper - hi)).toBeLessThan(5e-7);
    }
  });
  it("Benjamini-Hochberg adjusted p-values", () => {
    const adj = benjaminiHochberg(fx.bh.p);
    adj.forEach((v, i) => expect(v).toBeCloseTo(fx.bh.adjusted[i], 14));
  });
  it("t interval for a regional mean from its _stats sums", () => {
    for (const [n, sum, sumsq, mean, sd, lo, hi] of fx.areaMean) {
      const m = areaMean({ n, sum, sumsq });
      expect(m.mean).toBeCloseTo(mean, 12);
      expect(m.sd!).toBeCloseTo(sd, 10);
      expect(m.lower!).toBeCloseTo(lo, 9);
      expect(m.upper!).toBeCloseTo(hi, 9);
    }
  });
});

describe("OLS with robust standard errors (statsmodels)", () => {
  for (const c of fx.ols) {
    it(c.name, () => {
      const r = ols([c.x], c.y)!;
      expect(r.n).toBe(c.x.length);
      r.coef.forEach((b, j) => expect(rel(b, c.params[j])).toBeLessThan(1e-10));
      r.se.forEach((s, j) => expect(rel(s, c.bse[j])).toBeLessThan(1e-10));
      r.seHC0.forEach((s, j) => expect(rel(s, c.HC0[j])).toBeLessThan(1e-10));
      r.seHC1.forEach((s, j) => expect(rel(s, c.HC1[j])).toBeLessThan(1e-10));
      r.seHC3.forEach((s, j) => expect(rel(s, c.HC3[j])).toBeLessThan(1e-10));
      r.pHC3.forEach((p, j) => expect(p).toBeCloseTo(c.pHC3[j], 10));
      r.pClassical.forEach((p, j) => expect(p).toBeCloseTo(c.pvalues[j], 10));
      r.ciHC3.forEach(([lo, hi], j) => {
        expect(lo).toBeCloseTo(c.ciHC3[j][0], 10);
        expect(hi).toBeCloseTo(c.ciHC3[j][1], 10);
      });
      expect(r.r2).toBeCloseTo(c.rsquared, 12);
      expect(r.adjR2).toBeCloseTo(c.rsquared_adj, 12);
    });
  }
});

describe("Spearman with a paired percentile bootstrap (scipy)", () => {
  for (const c of fx.spearman) {
    it(c.name, () => {
      const o = fx.ols.find((x) => x.name === c.name)!;
      expect(pearson(rankdata(o.x), rankdata(o.y))).toBeCloseTo(c.rho, 12);
      const b = spearmanBootstrap(o.x, o.y, { B: 9999, seed: 57 });
      expect(b.n).toBe(c.n);
      // different random streams: the interval ends agree within Monte Carlo error
      expect(Math.abs(b.lower - c.low)).toBeLessThan(0.02);
      expect(Math.abs(b.upper - c.high)).toBeLessThan(0.02);
    });
  }
});

describe("spatial weights and Moran's I (PySAL libpysal + esda)", () => {
  it("rook contiguity from the TopoJSON arcs equals libpysal Rook on the same file", async () => {
    for (const unit of ["sa2", "lga"] as const) {
      const mine = await getAdjacency(unit);
      const theirs = fx.rook[unit] as Adjacency;
      expect(Object.keys(mine).sort()).toEqual(Object.keys(theirs).sort());
      for (const code of Object.keys(theirs)) expect(mine[code]).toEqual([...theirs[code]].sort());
    }
  });

  for (const c of fx.spatial) {
    describe(`${c.unit}/${c.topic} n>=${c.minTweets} ${c.weights}`, () => {
      it("pools the same regional means as the Python reference", async () => {
        const areas = await getAreaRecords(c.unit as "sa2" | "lga");
        const by = new Map(areas.map((a) => [a.code, a]));
        const retained = areas.filter((a) => (a.sums.all?.n ?? 0) >= c.minTweets).map((a) => a.code);
        expect(new Set([...c.codes, ...c.islands])).toEqual(new Set(retained));
        c.codes.forEach((code, i) => {
          const s = by.get(code)!.sums.all!;
          expect(s.sum / s.n).toBeCloseTo(c.y[i], 12);
        });
      });

      it("builds identical neighbour sets, global and local statistics", async () => {
        const areas = await getAreaRecords(c.unit as "sa2" | "lga");
        const by = new Map(areas.map((a) => [a.code, a]));
        const adjacency = await getAdjacency(c.unit as "sa2" | "lga");
        const ordered = [...c.codes, ...c.islands].map((code) => by.get(code)!);
        const { kept, islands, weights } = buildWeights(ordered, c.weights as "knn6" | "rook", adjacency);
        expect(islands.map((i) => ordered[i].code).sort()).toEqual([...c.islands].sort());
        expect(kept.map((i) => ordered[i].code)).toEqual(c.codes);
        const nb = c.neighbors as unknown as Record<string, string[]>;
        weights.neighbors.forEach((list, i) => {
          expect(list.map((j) => c.codes[j]).sort()).toEqual([...nb[c.codes[i]]].sort());
        });

        const m = moran(c.y, weights, { permutations: 9999, seed: 57 });
        for (const k of ["I", "EI", "VI_norm", "VI_rand", "z_norm", "z_rand"] as const)
          expect(rel(m[k], c.moran[k])).toBeLessThan(1e-9);
        expect(m.p_norm).toBeCloseTo(c.moran.p_norm, 10);
        expect(m.p_rand).toBeCloseTo(c.moran.p_rand, 10);
        expect(Math.abs(m.p_sim - c.moran.p_sim)).toBeLessThan(0.02);

        const lisa = localMoran(c.y, weights, { permutations: 9999, seed: 57 });
        lisa.Is.forEach((v, i) => expect(v).toBeCloseTo(c.lisa.Is[i], 10));
        expect(lisa.q).toEqual(c.lisa.q);
        // Ties: with a minimum of 1 tweet many regions average exactly 5.0, so a
        // region with one or two neighbours can have an atom of permuted values
        // equal to its observed statistic. We count ties as "at least as
        // extreme" (conservative); esda's numba kernel computes the permuted
        // statistic in a different floating-point order, so its ties fall on
        // either side. Compare only regions whose permutation distribution
        // cannot hit the observed value exactly.
        const counts = new Map<number, number>();
        for (const v of c.y) counts.set(v, (counts.get(v) ?? 0) + 1);
        const tieProne = (i: number) =>
          weights.neighbors[i].length <= 2 && weights.neighbors[i].some((j) => counts.get(c.y[j])! >= 3);
        let worst = 0;
        let skipped = 0;
        lisa.p_sim.forEach((p, i) => {
          if (tieProne(i)) skipped++;
          else worst = Math.max(worst, Math.abs(p - c.lisa.p_sim[i]));
        });
        expect(skipped / c.codes.length).toBeLessThan(0.15);
        expect(worst).toBeLessThan(0.025);
      });
    });
  }

  it("variance components match the numpy computation", async () => {
    for (const v of fx.varianceComponents) {
      const areas = await getAreaRecords(v.unit as "sa2" | "lga");
      const sums = areas.map((a) => a.sums[v.topic as "all"]).filter((s) => s !== undefined);
      const vc = varianceComponents(sums);
      expect(vc.k).toBe(v.k);
      expect(rel(vc.withinVar, v.withinVar)).toBeLessThan(1e-10);
      expect(rel(vc.betweenVar, v.betweenVar)).toBeLessThan(1e-8);
      expect(rel(vc.q, v.q)).toBeLessThan(1e-10);
    }
  });
});
