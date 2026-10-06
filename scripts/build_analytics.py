# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "pandas==3.0.6",
#   "numpy==2.5.3",
#   "scipy==1.18.1",
#   "geopandas==1.2.0",
#   "pyogrio==0.13.0",
#   "shapely==2.1.2",
# ]
# [tool.uv]
# exclude-newer = "2026-10-05T00:00:00Z"
# ///
"""Build the read-only analytics database and boundary files for the web app.

This script re-runs the *original* Team 57 processing logic (Flask
``app.py`` and the SUDO / Twitter notebooks, now in ``coursework/``) on the
original inputs, asserts that the results reproduce the Plotly figures the
2023 dashboard shipped, and writes compact artefacts for ``web/``:

* ``web/data/analytics.db``         read-only SQLite (aggregates only)
* ``web/public/geo/*.topo.json``    simplified boundaries (TopoJSON)
* ``web/src/lib/__fixtures__/*.json`` small fixtures for the TS parity tests

Inputs
------
1. Committed originals in ``coursework/2_ReactJS_frontend/frontend/public``
   (Plotly JSON shipped by the 2023 dashboard). Always available.
2. Raw inputs that were never committed (licensed or too large), read from
   ``--raw`` (default ``scripts/raw``; see scripts/README.md):

   - ``twitter/{sentimentLocation,incomeMentioned,crimeMentioned}.json``
     CouchDB MapReduce view exports (``_stats`` reduce per SAL code)
   - ``twitter/SAL_2021_AUST_GDA94_SHP/``   ABS SAL 2021 boundaries
   - ``sudo/personal_income.csv``           SUDO / ABS personal income by SA2
   - ``sudo/crime.csv``                     SUDO / VIC CSA offences by LGA
   - ``sudo/sa2_2016_aust_shape/``          ABS SA2 2016 boundaries
   - ``sudo/lga_2019_aust_shp/``            ABS LGA 2019 boundaries
   - ``sudo/GCCSA_2021_AUST_SHP_GDA2020/``  ABS GCCSA 2021 boundaries

Only aggregates are written. No tweet or toot text is read or stored.

Run:  uv run scripts/build_analytics.py [--raw PATH]
"""

from __future__ import annotations

import argparse
import gzip
import json
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
COURSEWORK = ROOT / "coursework"
PUBLIC_ORIG = COURSEWORK / "2_ReactJS_frontend" / "frontend" / "public"
MASTODON_DERIVED = ROOT / "scripts" / "derived" / "mastodon-social-2023-05.json"
WEB = ROOT / "web"
DB_PATH = WEB / "data" / "analytics.db"
GEO_DIR = WEB / "public" / "geo"
FIXTURES = WEB / "src" / "lib" / "__fixtures__"

WGS84 = "EPSG:4326"
STATE_BY_DIGIT = {
    "1": "New South Wales",
    "2": "Victoria",
    "3": "Queensland",
    "4": "South Australia",
    "5": "Western Australia",
    "6": "Tasmania",
    "7": "Northern Territory",
    "8": "Australian Capital Territory",
    "9": "Other Territories",
}
MIN_TWEET_THRESHOLDS = [1, 5, 10, 30]


def log(msg: str) -> None:
    print(f"[build_analytics] {msg}", flush=True)


def check(cond: bool, msg: str) -> None:
    """Parity assertion against the original outputs."""
    if not cond:
        raise SystemExit(f"PARITY FAILURE: {msg}")
    log(f"parity ok - {msg}")


def load_plotly(rel: str) -> dict:
    path = PUBLIC_ORIG / rel
    with gzip.open(path) if path.suffix == ".gz" else open(path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 1. Original outputs shipped with the 2023 dashboard (committed)
# ---------------------------------------------------------------------------

HISTOGRAM_FILES = {
    ("twitter", "all"): "twitter_data/summary/twitter_all_sentiment.json.gz",
    ("twitter", "income"): "twitter_data/summary/twitter_income_sentiment.json.gz",
    ("twitter", "crime"): "twitter_data/summary/twitter_crime_sentiment.json.gz",
    ("mastodon.social", "all"): "mastodon_data/mastodon_social_sentiment.json.gz",
    ("mastodon.social", "income"): "mastodon_data/mastodon_social_income.json.gz",
    ("mastodon.au", "all"): "mastodon_data/mastodon_au_sentiment.json.gz",
    ("mastodon.au", "income"): "mastodon_data/mastodon_au_income.json.gz",
    ("tictoc.social", "all"): "mastodon_data/mastodon_tictoc_sentiment.json.gz",
    ("tictoc.social", "income"): "mastodon_data/mastodon_tictoc_income.json.gz",
}


def read_histograms() -> pd.DataFrame:
    rows = []
    for (source, topic), rel in HISTOGRAM_FILES.items():
        fig = load_plotly(rel)
        trace = fig["data"][0]
        for score, count in zip(trace["x"], trace["y"]):
            rows.append(
                {"source": source, "topic": topic, "score": int(score), "count": int(count)}
            )
    return pd.DataFrame(rows)


def read_jobs_indicators() -> pd.DataFrame:
    fig = load_plotly("sudo_data/summary/median_income_sa2_bar.json.gz")
    mean_t, median_t = fig["data"][0], fig["data"][1]
    check(mean_t["name"] == "Mean" and median_t["name"] == "Median", "jobs bar traces")
    rows = []
    for i, ind in enumerate(mean_t["y"]):
        key = ind.strip()
        rows.append(
            {
                "indicator": key,
                "label": prettify_indicator(key),
                "kind": "jobs_000" if key.endswith("number_of_jobs_000") else "income_aud",
                "mean": mean_t["x"][i],
                "std": mean_t["error_x"]["array"][i],
                "median": median_t["x"][median_t["y"].index(ind)],
            }
        )
    return pd.DataFrame(rows)


ABBREVIATIONS = {
    "elctrcty_gs_wtr_wste_srvcs": "electricity_gas_water_waste_services",
    "infrmtn_mda_tlcmmnctns": "information_media_telecommunications",
    "mdn_emplye_incme_pr_jb": "median_employee_income_per_job",
    "mdn_emplye_incme_per_jb": "median_employee_income_per_job",
    "admnstrtv_spprt_srvcs": "administrative_support_services",
    "prfssnl_scntfc_tchncl_srvcs": "professional_scientific_technical_services",
    "rntl_hrng_rl_estte_srvcs": "rental_hiring_real_estate_services",
    "accmmdtn_fd_srvcs": "accommodation_food_services",
    "fnncl_insrnce_srvcs": "financial_insurance_services",
    "pblc_admnstrtn_sfty": "public_administration_safety",
    "agrcltr_frstry_fshng": "agriculture_forestry_fishing",
    "hlth_cre_scl_assstnce": "health_care_social_assistance",
    "trnsprt_pstl_wrhsng": "transport_postal_warehousing",
    "arts_rcrtn_srvcs": "arts_recreation_services",
}


def prettify_indicator(key: str) -> str:
    s = key
    for short, full in ABBREVIATIONS.items():
        s = s.replace(short, full)
    for suffix, label in [
        ("_median_employee_income_per_job", " - median income per job"),
        ("_number_of_jobs_000", " - jobs ('000)"),
    ]:
        if s.endswith(suffix):
            s = s[: -len(suffix)] + label
    s = s.replace("_and_", " & ").replace("_", " ")
    return s[:1].upper() + s[1:]


# ---------------------------------------------------------------------------
# 2. Raw inputs (not committed)
# ---------------------------------------------------------------------------


def read_couch_view(raw: Path, name: str) -> pd.DataFrame:
    """CouchDB `_stats` reduce rows: key=[SAL code], value={sum,count,min,max,sumsqr}."""
    rows = json.load(open(raw / "twitter" / name))["rows"]
    return pd.DataFrame(
        [{"sal_code": str(r["key"][0]), **r["value"]} for r in rows]
    ).rename(
        columns={
            "count": "tweet_count",
            "sum": "score_sum",
            "min": "score_min",
            "max": "score_max",
            "sumsqr": "score_sumsqr",
        }
    )


def ready_for_join_average(df: pd.DataFrame) -> pd.Series:
    """Original `ready_for_join`: (sum / count).round(2) with numpy rounding."""
    return (df["score_sum"] / df["tweet_count"]).round(2)


def iqr_filter(
    df: pd.DataFrame, columns: list[str], summary_columns: list[str] | None = None
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Original `drop_outliers`: describe(percentiles).round(2), then sequential IQR drops.

    The quartiles are computed once on the unfiltered frame, exactly as the
    notebooks / Flask app did.
    """
    summary = (
        df[summary_columns or columns]
        .describe(percentiles=[0.0, 0.25, 0.5, 0.75, 1.0])
        .round(2)
    )
    out = df
    for col in columns:
        q1 = summary[col]["25%"]
        q3 = summary[col]["75%"]
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        out = out.drop(out[(out[col] < lower) | (out[col] > upper)].index)
    return out, summary


def build(raw: Path) -> None:
    for rel in ["twitter/sentimentLocation.json", "sudo/personal_income.csv", "sudo/crime.csv"]:
        if not (raw / rel).exists():
            raise SystemExit(
                f"Missing raw input {raw / rel}. See scripts/README.md for how to obtain it."
            )

    # ---- originals -------------------------------------------------------
    hist = read_histograms()
    jobs = read_jobs_indicators()
    tw_map = load_plotly("twitter_data/map/twitter_vic_sal_2022_02_2022_07.json.gz")
    crime_map = load_plotly("sudo_data/map/crime_vic_lga.json.gz")
    crime_bar = load_plotly("sudo_data/summary/crime_vic_lga_bar.json.gz")
    income_map = load_plotly("sudo_data/map/median_income_sa2.json.gz")
    summaries = {
        "twitter": json.load(open(PUBLIC_ORIG / "twitter_data/summary/twitter.json")),
        "sudo": json.load(open(PUBLIC_ORIG / "sudo_data/summary/sudo.json")),
        "mastodon": json.load(open(PUBLIC_ORIG / "mastodon_data/mastodon.json")),
    }

    # ---- Twitter: CouchDB views + SAL boundaries ------------------------
    log("reading SAL 2021 boundaries (this takes a moment)")
    sal = gpd.read_file(raw / "twitter/SAL_2021_AUST_GDA94_SHP/SAL_2021_AUST_GDA94.shp")
    sal = sal[["SAL_CODE21", "SAL_NAME21", "STE_NAME21", "AREASQKM21", "geometry"]]

    views = {
        "all": read_couch_view(raw, "sentimentLocation.json"),
        "income": read_couch_view(raw, "incomeMentioned.json"),
        "crime": read_couch_view(raw, "crimeMentioned.json"),
    }
    for topic, df in views.items():
        df["avg_score"] = ready_for_join_average(df)
        df["topic"] = topic

    check(
        int(views["all"]["tweet_count"].sum())
        == int(hist.query("source=='twitter' and topic=='all'")["count"].sum()),
        "sentimentLocation total equals the original Twitter histogram total",
    )

    # Parity with the Plotly SAL map: same SALs, same counts, same rounded means.
    sal_vic = sal[sal["STE_NAME21"] == "Victoria"]
    name_to_code = dict(zip(sal_vic["SAL_NAME21"], sal_vic["SAL_CODE21"]))
    locs = tw_map["data"][0]["locations"]
    z = {t["name"]: t["z"] for t in tw_map["data"]}
    for topic, count_col, avg_col in [
        ("all", "count sentiment", "average_sentiment(sentiment)"),
        ("income", "count income", "average_sentiment(income)"),
        ("crime", "count crime", "average_sentiment(crime)"),
    ]:
        idx = views[topic].set_index("sal_code")
        mismatches = 0
        for k, name in enumerate(locs):
            code = name_to_code[name]
            exp_count, exp_avg = z[count_col][k], z[avg_col][k]
            if code in idx.index:
                row = idx.loc[code]
                ok = exp_count == row["tweet_count"] and exp_avg == row["avg_score"]
            else:
                ok = exp_count is None and exp_avg is None
            mismatches += 0 if ok else 1
        check(mismatches == 0, f"Twitter SAL map '{topic}' counts and averages ({len(locs)} SALs)")

    vic_with_data = set(name_to_code[n] for n in locs)

    twitter_sal = pd.concat(views.values(), ignore_index=True)
    twitter_sal["state"] = twitter_sal["sal_code"].str[0].map(STATE_BY_DIGIT)

    # ---- SUDO income (SA2 2016) -------------------------------------------
    log("reading SA2 2016 boundaries + personal income")
    sa2 = gpd.read_file(raw / "sudo/sa2_2016_aust_shape/SA2_2016_AUST.shp")
    df_income = pd.read_csv(raw / "sudo/personal_income.csv")
    df_income.dropna(inplace=True)
    df_income.drop_duplicates(inplace=True)
    df_income.rename(columns={" sa2_code": "SA2_MAIN16"}, inplace=True)
    sf_sa2 = sa2.astype({"SA2_MAIN16": int})
    merged_income = sf_sa2.merge(df_income, on="SA2_MAIN16")

    vic_income = merged_income[merged_income["STE_NAME16"] == "Victoria"]
    income_cols = ["mean_aud", " median_aud", " sum_aud"]
    vic_kept, vic_summary = iqr_filter(
        vic_income, income_cols, income_cols + [" median_age_of_earners_years"]
    )
    vic_kept = vic_kept.drop_duplicates()
    check(len(vic_income) == 457, "457 Victorian SA2s with income data")
    check(len(vic_kept) == 420, "420 Victorian SA2s remain after IQR filtering (report 6.2.1)")
    lo = vic_kept.loc[vic_kept[" median_aud"].idxmin()]
    hi = vic_kept.loc[vic_kept[" median_aud"].idxmax()]
    check(
        lo["SA2_NAME16"] == "Merbein" and lo[" median_aud"] == 28996,
        "lowest median income is Merbein, 28,996 AUD (report 6.2.1)",
    )
    check(
        hi["SA2_NAME16"] == "Sydenham" and hi[" median_aud"] == 62029,
        "highest median income is Sydenham, 62,029 AUD (report 6.2.1)",
    )

    # Which SA2s were drawn on the original national median-income map?
    from shapely.geometry import shape
    from shapely.strtree import STRtree

    mi = merged_income.reset_index(drop=True)
    tree = STRtree(list(mi.geometry))
    zi = income_map["data"][0]["z"]
    national_idx = []
    for k, feat in enumerate(income_map["data"][0]["geojson"]["features"]):
        p = shape(feat["geometry"]).representative_point()
        cands = [c for c in tree.query(p, predicate="within") if mi.loc[c, " median_aud"] == zi[k]]
        national_idx.append(cands[0] if len(cands) == 1 else -1)
    check(-1 not in national_idx, f"all {len(zi)} SA2s on the original national map identified")
    in_national = set(mi.loc[national_idx, "SA2_MAIN16"].tolist())

    kept_codes = set(vic_kept["SA2_MAIN16"].tolist())
    income_sa2 = pd.DataFrame(
        {
            "sa2_code": mi["SA2_MAIN16"].astype(str),
            "sa2_name": mi["SA2_NAME16"],
            "sa3_name": mi["SA3_NAME16"],
            "sa4_name": mi["SA4_NAME16"],
            "gcc_code": mi["GCC_CODE16"],
            "gcc_name": mi["GCC_NAME16"],
            "state": mi["STE_NAME16"],
            "mean_aud": mi["mean_aud"],
            "median_aud": mi[" median_aud"],
            "sum_aud": mi[" sum_aud"],
            "median_age": mi[" median_age_of_earners_years"],
            "on_national_map": mi["SA2_MAIN16"].isin(in_national).astype(int),
            "vic_iqr_kept": np.where(
                mi["STE_NAME16"] == "Victoria", mi["SA2_MAIN16"].isin(kept_codes).astype(int), None
            ),
        }
    )

    # GCC aggregates exactly as the original income_gcc figure was built.
    gcc = (
        mi.groupby(["GCC_CODE16", "GCC_NAME16"])
        .agg(
            mean_aud=("mean_aud", "mean"),
            median_aud=(" median_aud", "median"),
            sum_aud=(" sum_aud", "sum"),
            median_age=(" median_age_of_earners_years", "mean"),
            sa2_count=("SA2_MAIN16", "count"),
        )
        .reset_index()
        .rename(columns={"GCC_CODE16": "gcc_code", "GCC_NAME16": "gcc_name"})
    )
    act = gcc.set_index("gcc_code").loc["8ACTE"]
    check(round(act["median_aud"] / 1000, 1) == 60.2, "8ACTE median income 60.2k (SUDO summary)")
    rwau = gcc.set_index("gcc_code").loc["5RWAU"]
    check(round(rwau["mean_aud"] / 1000, 1) == 71.5, "5RWAU mean income 71.5k (SUDO summary)")

    # ---- SUDO crime (LGA) ---------------------------------------------------
    log("reading crime + LGA 2019 boundaries")
    df_crime = pd.read_csv(raw / "sudo/crime.csv")
    df_crime.fillna(0, inplace=True)
    df_crime.drop_duplicates(inplace=True)
    rename = {
        " total_division_a_offences": "against the person",
        " total_division_b_offences": "property and deception",
        " total_division_c_offences": "drug offences",
        " total_division_d_offences": "public order and security",
        " total_division_e_offences": "justice procedures",
        " total_division_f_offences": "other offences",
    }
    df_crime.rename(columns=rename, inplace=True)
    crime_cols = list(rename.values())
    crime_kept, crime_summary = iqr_filter(df_crime, crime_cols)
    check(len(df_crime) == 79 and len(crime_kept) == 72, "79 LGAs, 72 kept after IQR (report 6.3.1)")
    orig_names = crime_map["data"][0]["locations"]
    check(
        sorted(crime_kept[" lga_name11"].tolist()) == sorted(orig_names),
        "kept LGAs identical to the original crime map",
    )
    crime_kept = crime_kept.assign(total_all_offences=crime_kept[crime_cols].sum(axis=1))
    zt = dict(zip(orig_names, crime_map["data"][6]["z"]))
    check(
        all(zt[n] == t for n, t in zip(crime_kept[" lga_name11"], crime_kept["total_all_offences"])),
        "total_all_offences equals the original map values",
    )
    # bar chart parity (raw 79 LGAs, six categories)
    bar = {t["name"]: t["y"] for t in crime_bar["data"]}

    lga = gpd.read_file(raw / "sudo/lga_2019_aust_shp/LGA_2019_AUST.shp")
    lga = lga.astype({"LGA_CODE19": int})
    lga_vic = lga[lga["STE_NAME16"] == "Victoria"]
    crime_lga = df_crime.merge(
        lga_vic[["LGA_CODE19", "LGA_NAME19", "AREASQKM19"]],
        left_on=" lga_code11",
        right_on="LGA_CODE19",
        how="left",
    )
    check(crime_lga["LGA_NAME19"].notna().all(), "every crime LGA has a 2019 boundary")
    check(
        all(bar[n] == [int(r[c]) for c in crime_cols] for n, (_, r) in zip(crime_lga["LGA_NAME19"], crime_lga.iterrows())),
        "crime categories equal the original grouped bar chart (79 LGAs)",
    )
    crime_table = pd.DataFrame(
        {
            "lga_code": crime_lga[" lga_code11"].astype(str),
            "lga_name": crime_lga[" lga_name11"],
            "against_person": crime_lga["against the person"].astype(int),
            "property_deception": crime_lga["property and deception"].astype(int),
            "drug": crime_lga["drug offences"].astype(int),
            "public_order": crime_lga["public order and security"].astype(int),
            "justice": crime_lga["justice procedures"].astype(int),
            "other": crime_lga["other offences"].astype(int),
            "reference_period": crime_lga[" reference_period"].astype(int),
            "iqr_kept": crime_lga[" lga_name11"].isin(set(orig_names)).astype(int),
        }
    )
    crime_table["total"] = crime_table[
        ["against_person", "property_deception", "drug", "public_order", "justice", "other"]
    ].sum(axis=1)

    # ---- Regions + crosswalk (revival analysis) ----------------------------
    log("building SAL -> SA2 / LGA crosswalk (representative points)")
    sa2_vic = sa2[(sa2["STE_NAME16"] == "Victoria") & sa2.geometry.notna()].copy()
    lga_vic = lga_vic[lga_vic.geometry.notna()].copy()
    sal_data = sal[sal["SAL_CODE21"].isin(set(twitter_sal["sal_code"]))].copy()
    sal_data = sal_data[sal_data.geometry.notna()]
    pts = sal_data.copy()
    pts["geometry"] = sal_data.geometry.representative_point()
    j_sa2 = gpd.sjoin(pts, sa2_vic[["SA2_MAIN16", "geometry"]].to_crs(pts.crs), predicate="within", how="left")
    j_sa2 = j_sa2[~j_sa2.index.duplicated()]
    j_lga = gpd.sjoin(pts, lga_vic[["LGA_CODE19", "geometry"]].to_crs(pts.crs), predicate="within", how="left")
    j_lga = j_lga[~j_lga.index.duplicated()]
    rp = pts.to_crs(WGS84)
    regions_sal = pd.DataFrame(
        {
            "sal_code": sal_data["SAL_CODE21"],
            "name": sal_data["SAL_NAME21"],
            "state": sal_data["STE_NAME21"],
            "area_km2": sal_data["AREASQKM21"].round(3),
            "lat": rp.geometry.y.round(5),
            "lon": rp.geometry.x.round(5),
            "sa2_code16": j_sa2["SA2_MAIN16"].astype("string"),
            "lga_code19": j_lga["LGA_CODE19"].astype("Int64").astype("string"),
            "on_original_map": sal_data["SAL_CODE21"].isin(vic_with_data).astype(int),
        }
    )
    vic_sal_rows = regions_sal[regions_sal["state"] == "Victoria"]
    log(
        f"VIC SALs with tweets: {len(vic_sal_rows)}; mapped to SA2: {vic_sal_rows.sa2_code16.notna().sum()}; "
        f"to LGA: {vic_sal_rows.lga_code19.notna().sum()}"
    )

    sa2_rp = sa2_vic.geometry.representative_point().to_crs(WGS84)
    regions_sa2 = pd.DataFrame(
        {
            "sa2_code": sa2_vic["SA2_MAIN16"].astype(str),
            "name": sa2_vic["SA2_NAME16"],
            "sa3_name": sa2_vic["SA3_NAME16"],
            "sa4_name": sa2_vic["SA4_NAME16"],
            "gcc_code": sa2_vic["GCC_CODE16"],
            "area_km2": sa2_vic["AREASQKM16"].astype(float).round(3),
            "lat": sa2_rp.y.round(5),
            "lon": sa2_rp.x.round(5),
        }
    )
    lga_rp = lga_vic.geometry.representative_point().to_crs(WGS84)
    regions_lga = pd.DataFrame(
        {
            "lga_code": lga_vic["LGA_CODE19"].astype(str),
            "name": lga_vic["LGA_NAME19"],
            "area_km2": lga_vic["AREASQKM19"].astype(float).round(3),
            "lat": lga_rp.y.round(5),
            "lon": lga_rp.x.round(5),
        }
    )

    # ---- Scenario tables ----------------------------------------------------
    def topic_frame(topic: str) -> pd.DataFrame:
        return views[topic][["sal_code", "tweet_count", "score_sum"]]

    vic_x = vic_sal_rows[["sal_code", "sa2_code16", "lga_code19"]]

    def aggregate(by: str, topic: str) -> pd.DataFrame:
        d = vic_x.merge(topic_frame(topic), on="sal_code").dropna(subset=[by])
        g = d.groupby(by).agg(tweets=("tweet_count", "sum"), score_sum=("score_sum", "sum"))
        g["avg"] = g["score_sum"] / g["tweets"]
        g["sal_count"] = d.groupby(by)["sal_code"].nunique()
        return g

    sc_income = income_sa2[income_sa2["state"] == "Victoria"][
        ["sa2_code", "sa2_name", "median_aud", "mean_aud", "vic_iqr_kept"]
    ].copy()
    for topic, prefix in [("all", "all"), ("income", "income")]:
        g = aggregate("sa2_code16", topic)
        sc_income = sc_income.merge(
            g[["tweets", "avg", "sal_count"]].rename(
                columns={"tweets": f"tweets_{prefix}", "avg": f"avg_{prefix}", "sal_count": f"sals_{prefix}"}
            ),
            left_on="sa2_code",
            right_index=True,
            how="left",
        )
    sc_income["tweets_all"] = sc_income["tweets_all"].fillna(0).astype(int)
    sc_income["tweets_income"] = sc_income["tweets_income"].fillna(0).astype(int)
    sc_income = sc_income.drop(columns=["sals_income"]).rename(columns={"sals_all": "sal_count"})
    sc_income["sal_count"] = sc_income["sal_count"].fillna(0).astype(int)

    sc_crime = crime_table[["lga_code", "lga_name", "total", "iqr_kept"]].copy()
    for topic in ["all", "crime"]:
        g = aggregate("lga_code19", topic)
        sc_crime = sc_crime.merge(
            g[["tweets", "avg", "sal_count"]].rename(
                columns={"tweets": f"tweets_{topic}", "avg": f"avg_{topic}", "sal_count": f"sals_{topic}"}
            ),
            left_on="lga_code",
            right_index=True,
            how="left",
        )
    sc_crime["tweets_all"] = sc_crime["tweets_all"].fillna(0).astype(int)
    sc_crime["tweets_crime"] = sc_crime["tweets_crime"].fillna(0).astype(int)
    sc_crime = sc_crime.drop(columns=["sals_crime"]).rename(columns={"sals_all": "sal_count"})
    sc_crime["sal_count"] = sc_crime["sal_count"].fillna(0).astype(int)

    # ---- Correlations (scipy) - mirrored by src/lib/stats.ts ----------------
    corr_rows = []

    def corr(scenario: str, unit: str, xm: str, ym: str, wm: str, d: pd.DataFrame, k: int) -> None:
        sub = d[(d[wm] >= k) & d[xm].notna() & d[ym].notna()]
        x = sub[xm].astype(float).to_numpy()
        y = sub[ym].astype(float).to_numpy()
        n = len(x)
        if n < 3:
            return
        pr = stats.pearsonr(x, y)
        sr = stats.spearmanr(x, y)
        lr = stats.linregress(x, y)
        corr_rows.append(
            {
                "scenario": scenario,
                "unit": unit,
                "x_metric": xm,
                "y_metric": ym,
                "weight_metric": wm,
                "min_tweets": k,
                "n": n,
                "pearson_r": float(pr.statistic),
                "pearson_p": float(pr.pvalue),
                "spearman_rho": float(sr.statistic),
                "spearman_p": float(sr.pvalue),
                "slope": float(lr.slope),
                "intercept": float(lr.intercept),
                "r2": float(lr.rvalue**2),
            }
        )

    inc_kept = sc_income[sc_income["vic_iqr_kept"] == 1]
    crm_kept = sc_crime[sc_crime["iqr_kept"] == 1]
    for k in MIN_TWEET_THRESHOLDS:
        corr("income", "sa2", "median_aud", "avg_income", "tweets_income", inc_kept, k)
        corr("income", "sa2", "median_aud", "avg_all", "tweets_all", inc_kept, k)
        corr("crime", "lga", "total", "avg_crime", "tweets_crime", crm_kept, k)
        corr("crime", "lga", "total", "avg_all", "tweets_all", crm_kept, k)

    # Report 6.3.2 claim at SAL level: more crime discussion -> more negative.
    vc = views["crime"][views["crime"]["sal_code"].isin(vic_with_data)].copy()
    vc["log10_tweets"] = np.log10(vc["tweet_count"])
    vc["avg_raw"] = vc["score_sum"] / vc["tweet_count"]
    for k in MIN_TWEET_THRESHOLDS:
        corr("crime", "sal", "log10_tweets", "avg_raw", "tweet_count", vc, k)
    correlations = pd.DataFrame(corr_rows)

    # ---- Facts quoted in the team report --------------------------------------
    facts = pd.DataFrame(
        [
            ("twitter_corpus_gb", 57, "GB", "Report 4.1 - size of the provided Twitter corpus"),
            ("twitter_processed_gb", 15.9, "GB", "Report 4.1 - data processed before the deadline"),
            ("tweets_processed", 37823414, "tweets", "Report 4.1"),
            ("tweets_geotagged_report", 2418621, "tweets", "Report 4.1"),
            ("tweets_geotagged_couchdb", int(views["all"]["tweet_count"].sum()), "tweets", "CouchDB sentimentLocation view total"),
            ("toots_harvested", 1659690, "toots", "Report 4.2 (31-12-2021 to 22-10-2022)"),
            ("toots_harvested_mb", 757.9, "MB", "Report 4.2"),
            ("mastodon_servers", 3, "servers", "Report 4.2"),
            ("couchdb_nodes", 3, "nodes", "Report 3.3 - one 2-core master, two 1-core replicas"),
            ("mrc_vcpus", 8, "vCPU", "Report 2.1"),
            ("mrc_storage_gb", 500, "GB", "Report 2.1"),
            ("harvest_interval_min", 10, "minutes", "Report 4.2"),
            ("toots_per_request", 40, "toots", "Report 4.2"),
            ("couch_bulk_size", 1000, "documents", "Report 4.1 / processor.py COUNT"),
            ("vic_sals_with_tweets", len(vic_with_data), "SALs", "Original Twitter map"),
            ("vic_sa2_income_kept", 420, "SA2s", "Report 6.2.1"),
            ("vic_lga_crime_kept", 72, "LGAs", "Report 6.3.1"),
        ],
        columns=["key", "value", "unit", "source"],
    )

    summary_rows = []
    for item in summaries["twitter"]:
        for i, para in enumerate(item["data"]):
            summary_rows.append(("twitter", item["twitter"], i, para))
    for item in summaries["sudo"]:
        for i, para in enumerate(item["data"]):
            summary_rows.append(("sudo", item["sudo"], i, para))
    for item in summaries["mastodon"]:
        for i, para in enumerate(item["data"]):
            summary_rows.append(("mastodon", item["mastodon"], i, para))
    summary_text = pd.DataFrame(summary_rows, columns=["source", "dataset", "paragraph", "text"])

    servers = pd.DataFrame(
        [
            ("mastodon.social", "Mastodon Social", "https://mastodon.social", "One of the largest general-purpose Mastodon instances."),
            ("mastodon.au", "Mastodon AU", "https://mastodon.au", "An instance for the Australian community."),
            ("tictoc.social", "TicToc Social", "https://tictoc.social", "A general-purpose instance (shown as 'Mastodon TicToc' in the original dashboard)."),
        ],
        columns=["server", "label", "url", "description"],
    )

    # ---- Mastodon re-scored week (scripts/build_mastodon.py) -----------------------
    mastodon = load_mastodon_rescored()

    # ---- Write SQLite ------------------------------------------------------------
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_db = DB_PATH.with_suffix(".tmp")
    if tmp_db.exists():
        tmp_db.unlink()
    con = sqlite3.connect(tmp_db)
    con.executescript(SCHEMA)

    def insert(table: str, df: pd.DataFrame) -> None:
        cols = list(df.columns)
        q = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})"
        records = [
            tuple(None if (isinstance(v, float) and np.isnan(v)) or v is pd.NA else (v.item() if hasattr(v, "item") else v) for v in row)
            for row in df.itertuples(index=False, name=None)
        ]
        con.executemany(q, records)
        log(f"{table}: {len(records)} rows")

    meta = pd.DataFrame(
        [
            ("builder", "scripts/build_analytics.py"),
            ("twitter_period", "2022-02 to 2022-07"),
            ("sal_edition", "ABS ASGS Edition 3 (2021) SAL"),
            ("sa2_edition", "ABS ASGS 2016 SA2"),
            ("lga_edition", "ABS ASGS 2019 LGA"),
            ("crosswalk_method", "SAL representative point within SA2 / LGA polygon (GDA94)"),
            ("licence_note", "Aggregates only. ABS boundaries CC BY 4.0. No tweet or toot text."),
        ],
        columns=["key", "value"],
    )
    insert("meta", meta)
    insert("facts", facts)
    insert("summary_text", summary_text)
    insert("mastodon_servers", servers)
    insert("sentiment_histogram", hist)
    insert("regions_sal", regions_sal)
    insert("regions_sa2", regions_sa2)
    insert("regions_lga", regions_lga)
    insert(
        "twitter_sal_sentiment",
        twitter_sal[["sal_code", "topic", "state", "tweet_count", "score_sum", "score_min", "score_max", "score_sumsqr", "avg_score"]],
    )
    insert("income_sa2", income_sa2)
    insert("income_gcc", gcc)
    insert("jobs_income_indicators", jobs)
    insert("crime_lga", crime_table)
    insert("scenario_income_sa2", sc_income)
    insert("scenario_crime_lga", sc_crime)
    insert("scenario_correlations", correlations)
    if mastodon is not None:
        insert("mastodon_rescored_histogram", mastodon["histogram"])
        insert("mastodon_hourly", mastodon["hourly"])
        insert("mastodon_language", mastodon["languages"])
        insert(
            "facts",
            pd.DataFrame(
                [
                    ("mastodon_social_rescored_toots", mastodon["unique"], "toots", "scripts/build_mastodon.py - unique toots in the surviving raw harvest (2-9 May 2023)"),
                ],
                columns=["key", "value", "unit", "source"],
            ),
        )
    con.commit()
    con.execute("PRAGMA journal_mode=DELETE")
    con.execute("VACUUM")
    con.close()
    shutil.move(tmp_db, DB_PATH)
    log(f"wrote {DB_PATH.relative_to(ROOT)} ({DB_PATH.stat().st_size / 1024:.0f} KB)")

    # ---- Boundaries -> TopoJSON ---------------------------------------------------
    write_geometry(raw, sal_data, sal_vic, sa2_vic, lga_vic, vic_with_data)

    # ---- Fixtures for TS parity tests ---------------------------------------------
    write_fixtures(
        views=views,
        tw_locs=locs,
        tw_z=z,
        name_to_code=name_to_code,
        vic_income=vic_income,
        vic_summary=vic_summary,
        df_crime=df_crime,
        crime_cols=crime_cols,
        crime_summary=crime_summary,
        orig_crime_names=orig_names,
        mi=mi,
        gcc=gcc,
        sc_income=sc_income,
        sc_crime=sc_crime,
        vc=vc,
        correlations=correlations,
    )


SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE facts (key TEXT PRIMARY KEY, value REAL NOT NULL, unit TEXT, source TEXT);
CREATE TABLE summary_text (source TEXT, dataset TEXT, paragraph INTEGER, text TEXT,
  PRIMARY KEY (source, dataset, paragraph));
CREATE TABLE mastodon_servers (server TEXT PRIMARY KEY, label TEXT, url TEXT, description TEXT);
CREATE TABLE sentiment_histogram (source TEXT, topic TEXT, score INTEGER, count INTEGER,
  PRIMARY KEY (source, topic, score));
CREATE TABLE regions_sal (sal_code TEXT PRIMARY KEY, name TEXT, state TEXT, area_km2 REAL,
  lat REAL, lon REAL, sa2_code16 TEXT, lga_code19 TEXT, on_original_map INTEGER);
CREATE TABLE regions_sa2 (sa2_code TEXT PRIMARY KEY, name TEXT, sa3_name TEXT, sa4_name TEXT,
  gcc_code TEXT, area_km2 REAL, lat REAL, lon REAL);
CREATE TABLE regions_lga (lga_code TEXT PRIMARY KEY, name TEXT, area_km2 REAL, lat REAL, lon REAL);
CREATE TABLE twitter_sal_sentiment (sal_code TEXT, topic TEXT, state TEXT, tweet_count INTEGER,
  score_sum INTEGER, score_min INTEGER, score_max INTEGER, score_sumsqr INTEGER, avg_score REAL,
  PRIMARY KEY (sal_code, topic));
CREATE TABLE income_sa2 (sa2_code TEXT PRIMARY KEY, sa2_name TEXT, sa3_name TEXT, sa4_name TEXT,
  gcc_code TEXT, gcc_name TEXT, state TEXT, mean_aud REAL, median_aud REAL, sum_aud REAL,
  median_age REAL, on_national_map INTEGER, vic_iqr_kept INTEGER);
CREATE TABLE income_gcc (gcc_code TEXT PRIMARY KEY, gcc_name TEXT, mean_aud REAL, median_aud REAL,
  sum_aud REAL, median_age REAL, sa2_count INTEGER);
CREATE TABLE jobs_income_indicators (indicator TEXT PRIMARY KEY, label TEXT, kind TEXT,
  mean REAL, std REAL, median REAL);
CREATE TABLE crime_lga (lga_code TEXT PRIMARY KEY, lga_name TEXT, against_person INTEGER,
  property_deception INTEGER, drug INTEGER, public_order INTEGER, justice INTEGER, other INTEGER,
  reference_period INTEGER, iqr_kept INTEGER, total INTEGER);
CREATE TABLE scenario_income_sa2 (sa2_code TEXT PRIMARY KEY, sa2_name TEXT, median_aud REAL,
  mean_aud REAL, vic_iqr_kept INTEGER, tweets_all INTEGER, avg_all REAL, sal_count INTEGER,
  tweets_income INTEGER, avg_income REAL);
CREATE TABLE scenario_crime_lga (lga_code TEXT PRIMARY KEY, lga_name TEXT, total INTEGER,
  iqr_kept INTEGER, tweets_all INTEGER, avg_all REAL, sal_count INTEGER, tweets_crime INTEGER,
  avg_crime REAL);
CREATE TABLE scenario_correlations (scenario TEXT, unit TEXT, x_metric TEXT, y_metric TEXT,
  weight_metric TEXT, min_tweets INTEGER, n INTEGER, pearson_r REAL, pearson_p REAL,
  spearman_rho REAL, spearman_p REAL, slope REAL, intercept REAL, r2 REAL,
  PRIMARY KEY (scenario, unit, x_metric, y_metric, min_tweets));
CREATE TABLE mastodon_rescored_histogram (server TEXT, topic TEXT, score INTEGER, count INTEGER,
  PRIMARY KEY (server, topic, score));
CREATE TABLE mastodon_hourly (server TEXT, hour_utc TEXT, toots INTEGER, score_sum INTEGER,
  income_toots INTEGER, income_score_sum INTEGER, crime_toots INTEGER,
  b1 INTEGER, b2 INTEGER, b3 INTEGER, b4 INTEGER, b5 INTEGER, b6 INTEGER, b7 INTEGER, b8 INTEGER, b9 INTEGER,
  PRIMARY KEY (server, hour_utc));
CREATE TABLE mastodon_language (server TEXT, lang TEXT, toots INTEGER, score_sum INTEGER, income_toots INTEGER,
  b1 INTEGER, b2 INTEGER, b3 INTEGER, b4 INTEGER, b5 INTEGER, b6 INTEGER, b7 INTEGER, b8 INTEGER, b9 INTEGER,
  PRIMARY KEY (server, lang));
CREATE INDEX idx_twitter_topic ON twitter_sal_sentiment(topic);
CREATE INDEX idx_regions_sal_state ON regions_sal(state);
"""


def load_mastodon_rescored() -> dict | None:
    """Aggregates written by scripts/build_mastodon.py (committed, no toot text)."""
    if not MASTODON_DERIVED.exists():
        log(f"skipping Mastodon re-score tables ({MASTODON_DERIVED.relative_to(ROOT)} missing)")
        return None
    d = json.loads(MASTODON_DERIVED.read_text())
    server = "mastodon.social"
    hist = pd.DataFrame(
        [
            {"server": server, "topic": topic, "score": i + 1, "count": c}
            for topic, counts in d["histogram"].items()
            for i, c in enumerate(counts)
        ]
    )
    bcols = [f"b{i}" for i in range(1, 10)]
    hourly = pd.DataFrame(
        [
            {
                "server": server,
                "hour_utc": h["hour"],
                "toots": h["n"],
                "score_sum": h["sum"],
                "income_toots": h["income_n"],
                "income_score_sum": h["income_sum"],
                "crime_toots": h["crime_n"],
                **dict(zip(bcols, h["buckets"])),
            }
            for h in d["hourly"]
        ]
    )
    langs = pd.DataFrame(
        [
            {
                "server": server,
                "lang": l["lang"],
                "toots": l["n"],
                "score_sum": l["sum"],
                "income_toots": l["income_n"],
                **dict(zip(bcols, l["buckets"])),
            }
            for l in d["languages"]
        ]
    )
    check(int(hist.query("topic=='all'")["count"].sum()) == d["uniqueToots"], "Mastodon re-score histogram covers every unique toot")
    return {"histogram": hist, "hourly": hourly, "languages": langs, "unique": d["uniqueToots"]}


def run_mapshaper(src: Path, dst: Path, simplify: list[str], extra: list[str] | None = None) -> None:
    cmd = [
        "npx",
        "--yes",
        "mapshaper@0.6.121",  # pinned: simplification output must stay byte-identical
        "-i",
        str(src),
        "-simplify",
        *simplify,
        "keep-shapes",
        "-clean",
        *(extra or []),
        "-o",
        "format=topojson",
        "quantization=100000",
        str(dst),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)
    log(f"wrote {dst.relative_to(ROOT)} ({dst.stat().st_size / 1024:.0f} KB)")


def write_geometry(raw, sal_data, sal_vic, sa2_vic, lga_vic, vic_with_data) -> None:
    GEO_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        t = Path(td)
        sal_map = sal_vic[sal_vic["SAL_CODE21"].isin(vic_with_data)][["SAL_CODE21", "SAL_NAME21", "geometry"]]
        sal_map = sal_map.rename(columns={"SAL_CODE21": "code", "SAL_NAME21": "name"}).to_crs(WGS84)
        sal_map.to_file(t / "sal.geojson", driver="GeoJSON")
        run_mapshaper(t / "sal.geojson", GEO_DIR / "vic-sal.topo.json", ["dp", "6%"], ["-rename-layers", "sal"])

        sa2_out = sa2_vic[["SA2_MAIN16", "SA2_NAME16", "geometry"]].rename(
            columns={"SA2_MAIN16": "code", "SA2_NAME16": "name"}
        )
        sa2_out["code"] = sa2_out["code"].astype(str)
        sa2_out.to_crs(WGS84).to_file(t / "sa2.geojson", driver="GeoJSON")
        run_mapshaper(t / "sa2.geojson", GEO_DIR / "vic-sa2.topo.json", ["dp", "6%"], ["-rename-layers", "sa2"])

        lga_out = lga_vic[["LGA_CODE19", "LGA_NAME19", "geometry"]].rename(
            columns={"LGA_CODE19": "code", "LGA_NAME19": "name"}
        )
        lga_out["code"] = lga_out["code"].astype(str)
        lga_out.to_crs(WGS84).to_file(t / "lga.geojson", driver="GeoJSON")
        run_mapshaper(t / "lga.geojson", GEO_DIR / "vic-lga.topo.json", ["dp", "8%"], ["-rename-layers", "lga"])

        # Local fallback basemap: Australian states dissolved from GCCSA 2021.
        gccsa = gpd.read_file(raw / "sudo/GCCSA_2021_AUST_SHP_GDA2020/GCCSA_2021_AUST_GDA2020.shp")
        gccsa = gccsa[gccsa.geometry.notna()]
        states = gccsa.dissolve(by="STE_NAME21").reset_index()[["STE_NAME21", "geometry"]]
        states = states.rename(columns={"STE_NAME21": "name"}).to_crs(WGS84)
        states.to_file(t / "states.geojson", driver="GeoJSON")
        run_mapshaper(
            t / "states.geojson",
            GEO_DIR / "aus-states.topo.json",
            ["dp", "1.5%"],
            ["-filter-islands", "min-area=30km2", "-rename-layers", "states"],
        )


def write_fixtures(**k) -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)

    def dump(name: str, obj) -> None:
        p = FIXTURES / name
        p.write_text(json.dumps(_nan_to_none(obj), separators=(",", ":"), default=_default, allow_nan=False) + "\n")
        log(f"wrote {p.relative_to(ROOT)} ({p.stat().st_size / 1024:.0f} KB)")

    # Twitter: CouchDB `_stats` rows for the SALs on the original map, plus the
    # verbatim z arrays of the original Plotly figure.
    views, locs, z, n2c = k["views"], k["tw_locs"], k["tw_z"], k["name_to_code"]
    codes = [n2c[n] for n in locs]
    reduce_rows = {}
    for topic, df in views.items():
        sub = df[df["sal_code"].isin(set(codes))]
        reduce_rows[topic] = [
            [r.sal_code, int(r.score_sum), int(r.tweet_count)] for r in sub.itertuples()
        ]
    dump(
        "twitter-sal-parity.json",
        {
            "source": "coursework/2_ReactJS_frontend/frontend/public/twitter_data/map/twitter_vic_sal_2022_02_2022_07.json.gz",
            "locations": locs,
            "codes": codes,
            "z": z,
            "reduceRows": reduce_rows,
        },
    )

    vi = k["vic_income"]
    dump(
        "income-vic-parity.json",
        {
            "rows": [
                [r["SA2_NAME16"], float(r["mean_aud"]), float(r[" median_aud"]), float(r[" sum_aud"]), float(r[" median_age_of_earners_years"])]
                for _, r in vi.iterrows()
            ],
            "summary": _summary_dict(k["vic_summary"]),
            "expected": {"kept": 420, "min": ["Merbein", 28996], "max": ["Sydenham", 62029], "median": 45888.5},
        },
    )

    dc = k["df_crime"]
    dump(
        "crime-lga-parity.json",
        {
            "columns": k["crime_cols"],
            "rows": [[r[" lga_name11"], *[int(r[c]) for c in k["crime_cols"]]] for _, r in dc.iterrows()],
            "summary": _summary_dict(k["crime_summary"]),
            "expectedKept": sorted(k["orig_crime_names"]),
        },
    )

    mi = k["mi"]
    dump(
        "income-gcc-parity.json",
        {
            "rows": [
                [r["GCC_CODE16"], float(r["mean_aud"]), float(r[" median_aud"]), float(r[" sum_aud"]), float(r[" median_age_of_earners_years"])]
                for _, r in mi.iterrows()
            ],
            "expected": k["gcc"][["gcc_code", "mean_aud", "median_aud", "sum_aud", "median_age"]].values.tolist(),
        },
    )

    sci, scc, vc = k["sc_income"], k["sc_crime"], k["vc"]
    dump(
        "correlations-parity.json",
        {
            "income": sci[sci["vic_iqr_kept"] == 1][["sa2_code", "median_aud", "avg_income", "tweets_income", "avg_all", "tweets_all"]].values.tolist(),
            "crime": scc[scc["iqr_kept"] == 1][["lga_code", "total", "avg_crime", "tweets_crime", "avg_all", "tweets_all"]].values.tolist(),
            "crimeSal": vc[["sal_code", "log10_tweets", "avg_raw", "tweet_count"]].values.tolist(),
            "expected": k["correlations"].to_dict(orient="records"),
        },
    )


def _nan_to_none(o):
    """JSON has no NaN; pandas missing values become null."""
    if isinstance(o, float) and np.isnan(o):
        return None
    if isinstance(o, dict):
        return {k: _nan_to_none(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_nan_to_none(v) for v in o]
    return o


def _summary_dict(summary: pd.DataFrame) -> dict:
    return {col: {idx: float(summary[col][idx]) for idx in ["25%", "75%"]} for col in summary.columns}


def _default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if o is pd.NA:
        return None
    raise TypeError(type(o))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", type=Path, default=ROOT / "scripts" / "raw")
    args = ap.parse_args()
    build(args.raw.expanduser().resolve())


if __name__ == "__main__":
    sys.exit(main())
