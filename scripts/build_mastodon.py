# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#   "nltk==3.8.1",
#   "langdetect==1.0.9",
#   "beautifulsoup4==4.11.2",
# ]
# ///
"""Re-score the raw mastodon.social harvest with the ORIGINAL pipeline and keep aggregates.

The team's harvester (coursework/1_Flask_Backend/harvester/mastodon/toot.py)
stored every toot as

    content = normalize_string(BeautifulSoup(res.content, "html.parser").text)
    score   = sentiment_analysis(content)

and the CouchDB income view (coursework/4_Python_data_processing/scripts/
MapReduce/Income/mapIncome.js) matched keywords against that stored content.
CouchDB is gone, but the raw API responses for one week of mastodon.social
(2-9 May 2023, ~595k toots) survived on the author's drive. This script
re-applies the *unchanged* original functions (imported from coursework/) to
those toots and writes only aggregates:

    scripts/derived/mastodon-social-2023-05.json

which ``build_analytics.py`` loads into ``web/data/analytics.db``. No toot
text, author, URL or id leaves this script.

Run:  uv run scripts/build_mastodon.py [--raw scripts/raw] [--workers 8]
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
import warnings
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIG = ROOT / "coursework" / "4_Python_data_processing" / "scripts"
NLTK_DIR = ROOT / "scripts" / ".cache" / "nltk_data"
OUT = ROOT / "scripts" / "derived" / "mastodon-social-2023-05.json"

# Verbatim keyword lists from the CouchDB MapReduce views (coursework/.../MapReduce).
INCOME_WORDS = [
    "salary", "income", "housing", "mortgage", "liability", "debt",
    "expensive", "afford", "job", "work", "strike", "compensation", "luxur", "finance",
    "financial", "equality", "fairness", "inequal", "unfair",
]
CRIME_WORDS = [
    "crime", "criminal", "police", "theft", "robbery", "smuggl", "arrest", "kidnap",
    "homicide", "murder", "offence", "violence", "money laund",
]

_analyzer = None


def log(msg: str) -> None:
    print(f"[build_mastodon] {msg}", flush=True)


def _load_analyzer():
    global _analyzer
    if _analyzer is None:
        import nltk

        nltk.data.path.insert(0, str(NLTK_DIR))
        spec = importlib.util.spec_from_file_location(
            "orig_analyzer", ORIG / "sentimental_analysis" / "analyzer.py"
        )
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        _analyzer = mod
    return _analyzer


def mentions(content: str, words: list[str]) -> bool:
    """mapIncome.js / mapCrimeV2.js: content.toLowerCase().includes(word)."""
    lowered = content.lower()
    return any(w in lowered for w in words)


def score_chunk(chunk: list[tuple[str, str | None, str]]) -> list[tuple[str, str, int, bool, bool]]:
    from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning

    warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

    an = _load_analyzer()
    out = []
    for created_at, lang, html in chunk:
        # toot.py: extract_mastodon_info
        content = an.normalize_string(BeautifulSoup(html, "html.parser").text)
        score = an.sentiment_analysis(content)
        out.append(
            (created_at, lang or "und", score, mentions(content, INCOME_WORDS), mentions(content, CRIME_WORDS))
        )
    return out


def parse_time(s: str) -> datetime:
    # e.g. "2023-05-02 14:25:22+00:00" or "2023-05-02 14:25:21.692000+00:00"
    return datetime.fromisoformat(s).astimezone(timezone.utc)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", type=Path, default=ROOT / "scripts" / "raw")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    src = args.raw.expanduser().resolve() / "Mastodon_social"
    files = sorted(src.glob("Mastodon_social_*.json"))
    if not files:
        raise SystemExit(f"No raw harvest files under {src}. See scripts/README.md.")

    # Make sure the NLTK resources exist before forking workers.
    import nltk

    NLTK_DIR.mkdir(parents=True, exist_ok=True)
    for pkg in ["vader_lexicon", "punkt", "wordnet", "omw-1.4"]:
        nltk.download(pkg, download_dir=str(NLTK_DIR), quiet=True)

    seen: set[int] = set()
    records: list[tuple[str, str | None, str]] = []
    raw_total = 0
    for f in files:
        with open(f) as fh:
            statuses = json.load(fh)
        raw_total += len(statuses)
        for s in statuses:
            if s["id"] in seen:
                continue
            seen.add(s["id"])
            records.append((s["created_at"], s.get("language"), s.get("content") or ""))
        log(f"read {f.name}: {len(statuses)} toots")
        del statuses
    log(f"{raw_total} toots read, {len(records)} unique")

    chunk = 2000
    chunks = [records[i : i + chunk] for i in range(0, len(records), chunk)]
    t0 = time.time()
    scored: list[tuple[str, str, int, bool, bool]] = []
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        for i, part in enumerate(ex.map(score_chunk, chunks)):
            scored.extend(part)
            if i % 25 == 0:
                log(f"scored {len(scored)}/{len(records)} ({time.time() - t0:.0f}s)")
    log(f"scored {len(scored)} toots in {time.time() - t0:.0f}s")

    # ---- aggregates ------------------------------------------------------
    hist = {"all": Counter(), "income": Counter(), "crime": Counter()}
    hourly: dict[str, dict] = defaultdict(
        lambda: {"n": 0, "sum": 0, "income_n": 0, "income_sum": 0, "crime_n": 0, "buckets": [0] * 9}
    )
    langs: dict[str, dict] = defaultdict(lambda: {"n": 0, "sum": 0, "income_n": 0, "buckets": [0] * 9})
    window_start = datetime(2023, 5, 1, tzinfo=timezone.utc)
    outside_window = 0

    for created_at, lang, score, inc, crm in scored:
        hist["all"][score] += 1
        if inc:
            hist["income"][score] += 1
        if crm:
            hist["crime"][score] += 1
        lg = langs[lang]
        lg["n"] += 1
        lg["sum"] += score
        lg["buckets"][score - 1] += 1
        lg["income_n"] += int(inc)
        t = parse_time(created_at)
        if t < window_start:
            # a handful of old toots surface through boosts/edits; keep them in
            # the histograms but not in the hourly timeline
            outside_window += 1
            continue
        h = hourly[t.strftime("%Y-%m-%dT%H:00:00Z")]
        h["n"] += 1
        h["sum"] += score
        h["buckets"][score - 1] += 1
        if inc:
            h["income_n"] += 1
            h["income_sum"] += score
        if crm:
            h["crime_n"] += 1

    out = {
        "source": "Raw mastodon.social API responses harvested by Team 57 (May 2023); aggregates only",
        "pipeline": "toot.py extract_mastodon_info: BeautifulSoup(...).text -> normalize_string -> sentiment_analysis (NLTK 3.8.1)",
        "keywordViews": {"income": INCOME_WORDS, "crime": CRIME_WORDS},
        "rawToots": raw_total,
        "uniqueToots": len(records),
        "outsideWindow": outside_window,
        "histogram": {k: [v.get(s, 0) for s in range(1, 10)] for k, v in hist.items()},
        "hourly": [{"hour": k, **v} for k, v in sorted(hourly.items())],
        "languages": [
            {"lang": k, **v} for k, v in sorted(langs.items(), key=lambda kv: -kv[1]["n"])
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    log(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    sys.exit(main())
