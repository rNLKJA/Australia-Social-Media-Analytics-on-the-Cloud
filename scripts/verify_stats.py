# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "numpy==2.5.3",
#   "pandas==3.0.6",
#   "scipy==1.18.1",
#   "statsmodels==0.15.0",
#   "geopandas==1.2.0",
#   "pyogrio==0.13.0",
#   "shapely==2.1.2",
#   "libpysal==4.15.0",
#   "esda==2.10.0",
# ]
# [tool.uv]
# exclude-newer = "2026-10-05T00:00:00Z"
# ///
"""Reference values for the web app's statistics helpers (web/src/lib/stats).

The site computes every interval, permutation test and regression in
TypeScript (in the browser or at build time). This script computes the same
quantities with the standard Python implementations and writes them to
``web/src/lib/__fixtures__/stats-parity.json``; ``pnpm test`` then checks the
TypeScript against them:

* scipy.stats: normal and Student t distributions, Spearman's rho and a
  paired percentile bootstrap of it
* statsmodels: Wilson intervals, the exact McNemar test, Benjamini-Hochberg
  adjusted p-values, OLS with classical and HC0/HC1/HC3 standard errors
* PySAL (libpysal + esda): rook contiguity from the site's own TopoJSON
  boundaries, k-nearest-neighbour weights, global Moran's I (analytic moments
  and a 9,999-permutation p-value) and local Moran's I (LISA)

The regional inputs come from the committed ``web/data/analytics.db`` (no raw
data needed), pooled exactly as the site pools them: suburb (SAL) sums of the
CouchDB ``_stats`` reduce added up to SA2 / LGA.

Run:  uv run scripts/verify_stats.py
"""

from __future__ import annotations

import json
import sqlite3
import warnings
from pathlib import Path

import esda
import geopandas as gpd
import libpysal
import numpy as np
import pandas as pd
import scipy
import statsmodels
import statsmodels.api as sm
from scipy import stats
from statsmodels.stats.contingency_tables import mcnemar
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.proportion import proportion_confint

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
DB = WEB / "data" / "analytics.db"
GEO = WEB / "public" / "geo"
OUT = WEB / "src" / "lib" / "__fixtures__" / "stats-parity.json"

SEED = 57
PERMUTATIONS = 9999
LAT0 = -37.0  # equirectangular projection centre for k-NN (matches projectLonLat in spatial.ts)


def log(msg: str) -> None:
    print(f"[verify_stats] {msg}", flush=True)


def f(x) -> float:
    return float(np.asarray(x).item())


# ---------------------------------------------------------------------------
# Distributions, intervals and tests
# ---------------------------------------------------------------------------


def distributions() -> dict:
    xs = [-8.0, -5.0, -1.959963984540054, -1.0, -0.25, 0.0, 0.5, 1.6448536269514722, 3.0, 6.0]
    ps = [1e-10, 1e-4, 0.001, 0.025, 0.05, 0.3, 0.5, 0.8, 0.975, 0.999, 1 - 1e-9]
    t_ppf = [[p, df] for p in (0.975, 0.995, 0.9) for df in (1, 2, 5, 10, 30, 100, 1000)]
    t_cdf = [[t, df] for t in (-3.0, -0.5, 0.0, 1.2, 2.5) for df in (1, 3, 12, 60)]
    return {
        "normalCdf": [[x, f(stats.norm.cdf(x))] for x in xs],
        "normalSf": [[x, f(stats.norm.sf(x))] for x in xs],
        "normalPpf": [[p, f(stats.norm.ppf(p))] for p in ps],
        "tPpf": [[p, df, f(stats.t.ppf(p, df))] for p, df in t_ppf],
        "tCdf": [[t, df, f(stats.t.cdf(t, df))] for t, df in t_cdf],
    }


def intervals_and_tests() -> dict:
    wilson_cases = [(0, 10), (1, 10), (5, 10), (10, 10), (13, 15), (7, 20), (150, 420), (1, 2), (0, 1)]
    wil = []
    for k, n in wilson_cases:
        lo, hi = proportion_confint(k, n, alpha=0.05, method="wilson")
        wil.append([k, n, f(lo), f(hi)])
    mc = []
    for b, c in [(0, 0), (3, 0), (5, 1), (10, 4), (2, 9), (20, 25), (0, 7), (1, 1)]:
        res = mcnemar(np.array([[10, b], [c, 10]]), exact=True)
        mc.append([b, c, f(res.pvalue)])
    rng = np.random.default_rng(SEED)
    p = np.concatenate([rng.uniform(0, 1, 25), [0.0001, 0.004, 0.01, 0.02, 0.03, 0.049, 0.05]])
    adj = multipletests(p, alpha=0.05, method="fdr_bh")[1]
    area = []
    for n, mean, sd in [(2, 5.0, 1.0), (5, 6.2, 1.7), (30, 5.4, 1.9), (400, 5.6, 1.75)]:
        s = n * mean
        ss = (n - 1) * sd**2 + s * s / n
        t = stats.t.ppf(0.975, n - 1)
        se = sd / np.sqrt(n)
        area.append([n, s, ss, mean, sd, f(mean - t * se), f(mean + t * se)])
    return {
        "wilson": wil,
        "mcnemar": mc,
        "bh": {"p": p.tolist(), "adjusted": adj.tolist()},
        "areaMean": area,
    }


# ---------------------------------------------------------------------------
# Regional data, pooled from analytics.db
# ---------------------------------------------------------------------------

UNITS = {
    "sa2": {
        "col": "sa2_code16",
        "regions": "SELECT sa2_code AS code, name, lat, lon FROM regions_sa2",
        "cov": "SELECT sa2_code AS code, median_aud AS covariate, vic_iqr_kept AS kept FROM scenario_income_sa2",
        "topo": "vic-sa2.topo.json",
    },
    "lga": {
        "col": "lga_code19",
        "regions": "SELECT lga_code AS code, name, lat, lon FROM regions_lga",
        "cov": "SELECT lga_code AS code, total AS covariate, iqr_kept AS kept FROM scenario_crime_lga",
        "topo": "vic-lga.topo.json",
    },
}


def regional(con: sqlite3.Connection, unit: str, topic: str) -> pd.DataFrame:
    u = UNITS[unit]
    pooled = pd.read_sql(
        f"""SELECT r.{u['col']} AS code, SUM(t.tweet_count) AS n, SUM(t.score_sum) AS s,
                   SUM(t.score_sumsqr) AS ss
              FROM twitter_sal_sentiment t JOIN regions_sal r USING (sal_code)
             WHERE r.{u['col']} IS NOT NULL AND t.topic = ?
             GROUP BY r.{u['col']}""",
        con,
        params=(topic,),
    )
    d = pd.read_sql(u["regions"], con).merge(pd.read_sql(u["cov"], con), on="code", how="left")
    d = d.merge(pooled, on="code", how="left")
    d["n"] = d["n"].fillna(0).astype(int)
    d["y"] = d["s"] / d["n"].replace(0, np.nan)
    return d


def rook_neighbors(unit: str) -> dict[str, list[str]]:
    g = gpd.read_file(GEO / UNITS[unit]["topo"])
    w = libpysal.weights.Rook.from_dataframe(g, ids=g["code"].astype(str).tolist(), silence_warnings=True)
    return {str(k): sorted(str(x) for x in v) for k, v in w.neighbors.items()}


def project(d: pd.DataFrame) -> np.ndarray:
    return np.c_[d["lon"].to_numpy() * np.cos(np.deg2rad(LAT0)), d["lat"].to_numpy()]


def weights_for(d: pd.DataFrame, kind: str, rook: dict[str, list[str]]):
    """Weights on the retained regions; rook drops islands. Returns (frame, W, islands)."""
    codes = d["code"].tolist()
    if kind == "knn6":
        w = libpysal.weights.KNN.from_array(project(d), k=6, ids=codes)
        return d, w, []
    keep = set(codes)
    nb = {c: [x for x in rook.get(c, []) if x in keep] for c in codes}
    islands = [c for c in codes if not nb[c]]
    d2 = d[~d["code"].isin(islands)].reset_index(drop=True)
    nb2 = {c: nb[c] for c in d2["code"]}
    w = libpysal.weights.W(nb2, ids=d2["code"].tolist(), silence_warnings=True)
    return d2, w, islands


def spatial_case(con, rook_cache, unit: str, topic: str, min_tweets: int, kind: str) -> dict:
    d = regional(con, unit, topic)
    d = d[d["n"] >= min_tweets].reset_index(drop=True)
    d, w, islands = weights_for(d, kind, rook_cache[unit])
    w.transform = "r"
    y = d["y"].to_numpy(dtype=float)
    np.random.seed(SEED)
    m = esda.Moran(y, w, permutations=PERMUTATIONS)
    lisa = esda.Moran_Local(y, w, permutations=PERMUTATIONS, seed=SEED)
    order = w.id_order
    pos = {c: i for i, c in enumerate(d["code"])}
    assert order == d["code"].tolist(), "weights must follow the frame order"
    log(
        f"spatial {unit}/{topic} n>={min_tweets} {kind}: n={len(y)} islands={len(islands)} "
        f"I={m.I:.4f} p_sim={m.p_sim:.4f} LISA p<0.05={(lisa.p_sim < 0.05).sum()}"
    )
    return {
        "unit": unit,
        "topic": topic,
        "minTweets": min_tweets,
        "weights": kind,
        "codes": d["code"].tolist(),
        "y": y.tolist(),
        "neighbors": {c: sorted(w.neighbors[c], key=lambda x: pos[x]) for c in d["code"]},
        "islands": islands,
        "moran": {
            "I": f(m.I),
            "EI": f(m.EI),
            "VI_norm": f(m.VI_norm),
            "VI_rand": f(m.VI_rand),
            "z_norm": f(m.z_norm),
            "z_rand": f(m.z_rand),
            "p_norm": f(m.p_norm),
            "p_rand": f(m.p_rand),
            "p_sim": f(m.p_sim),
        },
        "lisa": {
            "Is": lisa.Is.tolist(),
            "q": lisa.q.astype(int).tolist(),
            "p_sim": lisa.p_sim.tolist(),
        },
    }


def regressions(con) -> tuple[list, list]:
    cases = []
    inc = regional(con, "sa2", "all")
    inc = inc[(inc["kept"] == 1) & (inc["n"] >= 30)]
    cases.append(("income_sa2_all_n30", (inc["covariate"] / 10000).to_numpy(float), inc["y"].to_numpy(float)))
    inc1 = regional(con, "sa2", "income")
    inc1 = inc1[(inc1["kept"] == 1) & (inc1["n"] >= 1)]
    cases.append(("income_sa2_income_n1", (inc1["covariate"] / 10000).to_numpy(float), inc1["y"].to_numpy(float)))
    cr = regional(con, "lga", "all")
    cr = cr[(cr["kept"] == 1) & (cr["n"] >= 30)]
    cases.append(("crime_lga_all_n30", np.log10(cr["covariate"].to_numpy(float)), cr["y"].to_numpy(float)))
    cr1 = regional(con, "lga", "crime")
    cr1 = cr1[(cr1["kept"] == 1) & (cr1["n"] >= 1)]
    cases.append(("crime_lga_crime_n1", np.log10(cr1["covariate"].to_numpy(float)), cr1["y"].to_numpy(float)))

    ols_out, spear_out = [], []
    for name, x, y in cases:
        X = sm.add_constant(x)
        fit = sm.OLS(y, X).fit()
        h0 = sm.OLS(y, X).fit(cov_type="HC0")
        h1 = sm.OLS(y, X).fit(cov_type="HC1")
        h3 = sm.OLS(y, X).fit(cov_type="HC3")
        ols_out.append(
            {
                "name": name,
                "x": x.tolist(),
                "y": y.tolist(),
                "params": fit.params.tolist(),
                "bse": fit.bse.tolist(),
                "pvalues": fit.pvalues.tolist(),
                "HC0": h0.bse.tolist(),
                "HC1": h1.bse.tolist(),
                "HC3": h3.bse.tolist(),
                "pHC3": h3.pvalues.tolist(),
                "ciHC3": h3.conf_int().tolist(),
                "rsquared": f(fit.rsquared),
                "rsquared_adj": f(fit.rsquared_adj),
            }
        )
        rho = stats.spearmanr(x, y).statistic
        boot = stats.bootstrap(
            (x, y),
            lambda a, b: stats.spearmanr(a, b).statistic,
            paired=True,
            vectorized=False,
            n_resamples=PERMUTATIONS,
            method="percentile",
            random_state=np.random.default_rng(SEED),
        )
        spear_out.append(
            {
                "name": name,
                "n": int(len(x)),
                "rho": f(rho),
                "low": f(boot.confidence_interval.low),
                "high": f(boot.confidence_interval.high),
            }
        )
        log(
            f"{name}: n={len(x)} slope={fit.params[1]:.4f} HC3 se={h3.bse[1]:.4f} "
            f"rho={rho:.3f} [{boot.confidence_interval.low:.3f}, {boot.confidence_interval.high:.3f}]"
        )
    return ols_out, spear_out


def variance_components(con) -> list:
    out = []
    for unit, topic in [("sa2", "all"), ("sa2", "income"), ("lga", "all"), ("lga", "crime")]:
        d = regional(con, unit, topic)
        d = d[d["n"] >= 2]
        n, s, ss = d["n"].to_numpy(float), d["s"].to_numpy(float), d["ss"].to_numpy(float)
        within = np.maximum(0, ss - s * s / n).sum() / (n - 1).sum()
        w = n / within
        ybar = (w * s / n).sum() / w.sum()
        q = (w * (s / n - ybar) ** 2).sum()
        tau2 = max(0.0, (q - (len(d) - 1)) / (w.sum() - (w**2).sum() / w.sum()))
        out.append({"unit": unit, "topic": topic, "k": int(len(d)), "withinVar": f(within), "betweenVar": tau2, "q": f(q)})
        log(f"variance components {unit}/{topic}: sigma_w={np.sqrt(within):.3f} tau={np.sqrt(tau2):.3f}")
    return out


def main() -> None:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rook_cache = {u: rook_neighbors(u) for u in UNITS}
    spatial = [
        spatial_case(con, rook_cache, "sa2", "all", 30, "knn6"),
        spatial_case(con, rook_cache, "sa2", "all", 30, "rook"),
        spatial_case(con, rook_cache, "sa2", "all", 1, "rook"),
        spatial_case(con, rook_cache, "lga", "all", 1, "rook"),
        spatial_case(con, rook_cache, "lga", "all", 30, "knn6"),
    ]
    ols_out, spear_out = regressions(con)
    fixture = {
        "generator": "scripts/verify_stats.py",
        "versions": {
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "statsmodels": statsmodels.__version__,
            "libpysal": libpysal.__version__,
            "esda": esda.__version__,
        },
        "seed": SEED,
        "permutations": PERMUTATIONS,
        **distributions(),
        **intervals_and_tests(),
        "rook": rook_cache,
        "spatial": spatial,
        "ols": ols_out,
        "spearman": spear_out,
        "varianceComponents": variance_components(con),
    }
    OUT.write_text(json.dumps(fixture, separators=(",", ":")) + "\n")
    log(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
