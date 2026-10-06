import { describe, expect, it } from "vitest";
import gcc from "@/lib/__fixtures__/income-gcc-parity.json";
import tw from "@/lib/__fixtures__/twitter-sal-parity.json";
import { aggregateByGcc, averageSentiment, tweetVolumeShares } from "./aggregate";

/** Original Plotly figure: twitter_vic_sal_2022_02_2022_07.json.gz (z arrays per trace). */
const z = tw.z as Record<string, (number | null)[]>;
type Reduce = [string, number, number];

describe("Twitter SAL map parity (app.py create_choropleth_map_twitter)", () => {
  for (const [topic, countKey, avgKey] of [
    ["all", "count sentiment", "average_sentiment(sentiment)"],
    ["income", "count income", "average_sentiment(income)"],
    ["crime", "count crime", "average_sentiment(crime)"],
  ] as const) {
    it(`reproduces '${countKey}' and '${avgKey}' for all ${tw.codes.length} SALs`, () => {
      const rows = new Map((tw.reduceRows[topic] as Reduce[]).map((r) => [r[0], r]));
      const counts: (number | null)[] = [];
      const avgs: (number | null)[] = [];
      for (const code of tw.codes) {
        const r = rows.get(code);
        counts.push(r ? r[2] : null);
        avgs.push(r ? averageSentiment({ sum: r[1], count: r[2] }) : null);
      }
      expect(counts).toEqual(z[countKey]);
      expect(avgs).toEqual(z[avgKey]);
    });
  }
});

describe("report 6.2.2 / 6.3.2 tweet-volume shares (SAL level)", () => {
  const counts = (topic: "income" | "crime") => (tw.reduceRows[topic] as Reduce[]).map((r) => r[2]);
  it("income: 73% / 22% / 4.7% (bins <10, 10-99, >=100)", () => {
    const [a, b, c] = tweetVolumeShares(counts("income"), false);
    expect([Math.round(a * 100), Math.round(b * 100), Math.round(c * 1000) / 10]).toEqual([73, 22, 4.7]);
  });
  it("crime: 79% / 18% / 3% (bins <=10, 11-100, >100)", () => {
    const [a, b, c] = tweetVolumeShares(counts("crime"), true);
    expect([Math.round(a * 100), Math.round(b * 100), Math.round(c * 100)]).toEqual([79, 18, 3]);
  });
  it("Melbourne has 23,281 income and 4,026 crime tweets; Ballarat Central 485 crime tweets", () => {
    const find = (topic: "income" | "crime", name: string) => {
      const code = tw.codes[tw.locations.indexOf(name)];
      return (tw.reduceRows[topic] as Reduce[]).find((r) => r[0] === code)?.[2];
    };
    expect(find("income", "Melbourne")).toBe(23281);
    expect(find("crime", "Melbourne")).toBe(4026);
    expect(find("crime", "Ballarat Central")).toBe(485);
  });
});

describe("SUDO GCC summary parity", () => {
  type Row = [string, number, number, number, number];
  const got = aggregateByGcc(
    (gcc.rows as Row[]).map(([g, mean, median, sum, age]) => ({ gcc: g, mean, median, sum, medianAge: age })),
  );
  it("matches pandas groupby for all 15 GCCs", () => {
    expect(got.map((g) => g.gcc)).toEqual(gcc.expected.map((e) => e[0]));
    got.forEach((g, i) => {
      const [, mean, median, sum, age] = gcc.expected[i] as Row;
      expect(g.meanAud).toBeCloseTo(mean, 8);
      expect(g.medianAud).toBe(median);
      expect(g.sumAud).toBe(sum);
      expect(g.medianAge).toBeCloseTo(age, 10);
    });
  });
  it("quotes the summary text: 5RWAU mean 71.5k, 2RVIC mean 49.6k, 8ACTE median 60.2k, 2RVIC median 41.4k", () => {
    const k = (code: string) => got.find((g) => g.gcc === code)!;
    expect((k("5RWAU").meanAud / 1000).toFixed(1)).toBe("71.5");
    expect((k("2RVIC").meanAud / 1000).toFixed(1)).toBe("49.6");
    expect((k("8ACTE").medianAud / 1000).toFixed(1)).toBe("60.2");
    expect((k("2RVIC").medianAud / 1000).toFixed(1)).toBe("41.4");
  });
});
