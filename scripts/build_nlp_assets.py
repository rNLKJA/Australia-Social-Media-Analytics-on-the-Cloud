# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#   "nltk==3.8.1",
#   "langdetect==1.0.9",
#   "regex==2026.9.29",
#   "beautifulsoup4==4.11.2",
# ]
# [tool.uv]
# exclude-newer = "2026-10-05T00:00:00Z"
# ///
"""Export the NLP resources used by the original pipeline and record parity fixtures.

The 2023 pipeline (coursework/4_Python_data_processing/scripts) scored every
tweet and toot with NLTK 3.8.1:

    content -> strip @mentions / #hashtags / URLs (twitter/processor.py)
            -> normalize_string: word_tokenize + WordNetLemmatizer (analyzer.py)
            -> sentiment_analysis: VADER compound -> 1..9 bucket (analyzer.py)

and geocoded tweets by matching normalised ``place.full_name`` n-grams
against a SAL dictionary (twitter/utils.py + data/sal.processed.dict.pkl).

Toots took a shorter path in the Mastodon harvester
(coursework/1_Flask_Backend/harvester/mastodon/toot.py):

    content (HTML) -> BeautifulSoup(..., "html.parser").text
                   -> normalize_string -> sentiment_analysis
    (no mention/hashtag/link stripping, no geocoding)

This script exports the exact resources those functions use, so the
TypeScript port in web/src/lib/nlp can run in the browser, and records the
outputs of the ORIGINAL Python functions on a synthetic corpus so the port
can be parity-tested.

Outputs
  web/public/data/nlp/vader-lexicon.json          VADER lexicon (MIT licence)
  web/public/data/nlp/wordnet-nouns.fc.txt        WordNet 3.0 noun lemmas, front-coded (WordNet licence)
  web/public/data/nlp/wordnet-noun-exceptions.json
  web/public/data/nlp/punkt-english.json          Punkt English model parameters
  web/public/data/nlp/sal-lookup.json             location string -> SAL 2021 code
  web/public/data/nlp/html-entities.json          the entity table BeautifulSoup 4.11 decodes
  web/src/lib/__fixtures__/nlp-parity.json        Python outputs for the parity tests

Run:  uv run scripts/build_nlp_assets.py
"""

from __future__ import annotations

import importlib.util
import json
import pickle
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIG_SCRIPTS = ROOT / "coursework" / "4_Python_data_processing" / "scripts"
SAL_DICT = ROOT / "coursework" / "4_Python_data_processing" / "data" / "sal.processed.dict.pkl"
OUT = ROOT / "web" / "public" / "data" / "nlp"
FIXTURES = ROOT / "web" / "src" / "lib" / "__fixtures__"
CORPUS = ROOT / "scripts" / "fixtures" / "nlp_parity_corpus.txt"
TOOT_CORPUS = ROOT / "scripts" / "fixtures" / "toot_parity_corpus.txt"
HARVESTER = ROOT / "coursework" / "1_Flask_Backend" / "harvester" / "mastodon"
NLTK_DIR = ROOT / "scripts" / ".cache" / "nltk_data"


def log(msg: str) -> None:
    print(f"[build_nlp_assets] {msg}", flush=True)


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument(
        "--sample",
        type=int,
        default=0,
        help="also score N real toots from scripts/raw/Mastodon_social for a local-only "
        "TS-vs-Python cross-check (written OUTSIDE the repo, never committed)",
    )
    ap.add_argument("--sample-out", type=Path, default=Path("/tmp/social-sense-nlp-sample.json"))
    args = ap.parse_args()

    import nltk

    NLTK_DIR.mkdir(parents=True, exist_ok=True)
    nltk.data.path.insert(0, str(NLTK_DIR))
    for pkg in ["vader_lexicon", "punkt", "wordnet", "omw-1.4"]:
        nltk.download(pkg, download_dir=str(NLTK_DIR), quiet=True)

    # The ORIGINAL modules, imported from coursework/ unchanged.
    analyzer = load_module("orig_analyzer", ORIG_SCRIPTS / "sentimental_analysis" / "analyzer.py")
    tw_utils = load_module("orig_twitter_utils", ORIG_SCRIPTS / "twitter" / "utils.py")
    toot = load_harvester_toot(nltk)

    from nltk.corpus import wordnet as wn
    from nltk.sentiment.vader import SentimentIntensityAnalyzer
    from nltk.tokenize import sent_tokenize, word_tokenize

    OUT.mkdir(parents=True, exist_ok=True)
    FIXTURES.mkdir(parents=True, exist_ok=True)

    # ---- VADER lexicon ------------------------------------------------------
    sia = SentimentIntensityAnalyzer()
    lexicon = sia.lexicon
    write_json(OUT / "vader-lexicon.json", lexicon)

    # ---- WordNet nouns + exceptions -----------------------------------------
    wn.ensure_loaded()
    nouns = sorted(k for k, v in wn._lemma_pos_offset_map.items() if "n" in v)
    # Front-coded: each line is chr(48 + shared-prefix-length) + suffix.
    lines, prev = [], ""
    for w in nouns:
        k = 0
        while k < min(len(prev), len(w)) and prev[k] == w[k]:
            k += 1
        lines.append(chr(48 + k) + w[k:])
        prev = w
    fc = OUT / "wordnet-nouns.fc.txt"
    fc.write_text("\n".join(lines) + "\n")
    stale = OUT / "wordnet-nouns.txt"
    if stale.exists():
        stale.unlink()
    log(f"{fc.name}: {len(nouns)} lemmas ({fc.stat().st_size / 1024:.0f} KB, front-coded)")
    write_json(OUT / "wordnet-noun-exceptions.json", dict(wn._exception_map["n"]))

    # ---- Punkt English parameters -------------------------------------------
    punkt = nltk.data.load("tokenizers/punkt/english.pickle")
    params = punkt._params
    write_json(
        OUT / "punkt-english.json",
        {
            "abbrevTypes": sorted(params.abbrev_types),
            "collocations": sorted([list(c) for c in params.collocations]),
            "sentStarters": sorted(params.sent_starters),
            "orthoContext": {k: v for k, v in sorted(params.ortho_context.items()) if v},
        },
    )

    # ---- SAL lookup (location string -> SAL code) ---------------------------
    with open(SAL_DICT, "rb") as f:
        sal_dict = pickle.load(f)
    write_json(OUT / "sal-lookup.json", {k: str(v) for k, v in sal_dict.items()})

    # ---- HTML entities (BeautifulSoup .text, used by the toot path) -------------
    from bs4.dammit import EntitySubstitution

    write_json(OUT / "html-entities.json", dict(sorted(EntitySubstitution.HTML_ENTITY_TO_CHARACTER.items())))

    # ---- Parity fixtures -----------------------------------------------------
    # One example per line; the two-character sequence "\\n" encodes a newline.
    corpus = [
        line.replace("\\n", "\n")
        for line in CORPUS.read_text().split("\n")
        if line.strip() and not line.startswith("#")
    ]
    examples = []
    for text in corpus:
        cleaned = clean_content(text)
        normalized = analyzer.normalize_string(cleaned)
        scores = analyzer.sia.polarity_scores(normalized)
        examples.append(
            {
                "text": text,
                "cleaned": cleaned,
                "sentences": sent_tokenize(cleaned),
                "tokens": word_tokenize(cleaned),
                "normalized": normalized,
                "scores": scores,
                "bucket": analyzer.sentiment_analysis(normalized),
                "rawScores": sia.polarity_scores(text),
                "description": analyzer.sentiment_description(analyzer.sentiment_analysis(normalized)),
            }
        )

    lemma_words = [
        "dogs", "churches", "aardwolves", "abaci", "hardrock", "geese", "women", "men",
        "feet", "glasses", "boxes", "buzzes", "wishes", "cities", "Dogs", "running",
        "was", "has", "news", "species", "series", "lmao", "!", "...", "cats.", "knives",
        "wolves", "mice", "children", "teeth", "analyses", "crises", "rates", "bills",
    ]
    lemmatizer = analyzer.lemmatizer
    lemmas = [[w, lemmatizer.lemmatize(w)] for w in lemma_words]

    location_inputs = [
        "Melbourne, Victoria",
        "Carlton, Victoria",
        "Ballarat, Victoria",
        "Geelong, Victoria",
        "Brunswick East, Victoria",
        "Sydney, New South Wales",
        "Hobart, Tasmania",
        "Perth, Western Australia",
        "Footscray, Melbourne",
        "St Kilda, Victoria",
        "Box Hill, Victoria",
        "Melbourne",
        "Victoria, Australia",
        "Australia",
        "Mount Waverley, Victoria",
    ]
    locations = [geocode_original(tw_utils, sal_dict, s) for s in location_inputs]

    punkt_inputs = [
        "Dr. Smith said the clinic will open at 9 a.m. tomorrow. Great news.",
        "Wait... what? The footy was cancelled?? Ugh.",
        "The U.S. economy and the A.U. dollar both moved today.",
        "I paid $3.50. It was cheap. Mr. Jones agreed.",
        "(It was late.) Then we left.",
        "Version 2. Released today! See you at 5 p.m. in St. Kilda.",
    ]
    punkt_cases = [[t, sent_tokenize(t), word_tokenize(t)] for t in punkt_inputs]

    # Toot path: the harvester's own extract_mastodon_info() on synthetic statuses.
    from bs4 import BeautifulSoup

    toot_inputs = [
        line.replace("\\n", "\n")
        for line in TOOT_CORPUS.read_text().split("\n")
        if line.strip() and not line.startswith("#")
    ]
    toots = []
    for html in toot_inputs:
        record = toot.extract_mastodon_info(fake_status(html))
        text = BeautifulSoup(html, "html.parser").text
        assert record.content == analyzer.normalize_string(text), html
        toots.append(
            {
                "html": html,
                "text": text,
                "tokens": word_tokenize(text),
                "normalized": record.content,
                "scores": sia.polarity_scores(record.content),
                "bucket": record.score,
            }
        )

    if args.sample:
        write_sample(analyzer, args.sample, args.sample_out)

    write_json(
        FIXTURES / "nlp-parity.json",
        {
            "nltkVersion": nltk.__version__,
            "examples": examples,
            "toots": toots,
            "lemmas": lemmas,
            "locations": locations,
            "punkt": punkt_cases,
        },
        pretty=True,
    )


def write_sample(analyzer, n: int, out: Path) -> None:
    """Score n real toots with the original functions for a local cross-check.

    The output contains real public toot text, so it is written to /tmp (or
    --sample-out) and must never be committed.
    """
    from bs4 import BeautifulSoup

    raw = ROOT / "scripts" / "raw" / "Mastodon_social" / "Mastodon_social_2.json"
    statuses = json.loads(raw.read_text())
    step = max(1, len(statuses) // n)
    rows = []
    from nltk.tokenize import word_tokenize

    for s in statuses[::step][:n]:
        html = s.get("content") or ""
        text = BeautifulSoup(html, "html.parser").text
        normalized = analyzer.normalize_string(text)
        scores = analyzer.sia.polarity_scores(normalized)
        rows.append(
            {
                "html": html,
                "text": text,
                "tokens": word_tokenize(text),
                "normalized": normalized,
                "scores": scores,
                "compound": scores["compound"],
                "bucket": analyzer.sentiment_analysis(normalized),
            }
        )
    out.write_text(json.dumps(rows, ensure_ascii=False))
    log(f"wrote {len(rows)} sample rows to {out} (local only)")


def load_harvester_toot(nltk):
    """Import coursework/.../harvester/mastodon/toot.py unchanged.

    Its sibling utils.py calls nltk.download() at import time; the resources
    are already in NLTK_DIR, so the downloads are skipped rather than fetched
    into the user's home directory.
    """
    real_download = nltk.download
    nltk.download = lambda *a, **k: True
    sys.path.insert(0, str(HARVESTER))
    try:
        sys.modules.pop("utils", None)
        return load_module("orig_toot", HARVESTER / "toot.py")
    finally:
        sys.path.remove(str(HARVESTER))
        sys.modules.pop("utils", None)
        nltk.download = real_download


class _Status(dict):
    """Mastodon.py's AttribAccessDict: keys readable as attributes."""

    __getattr__ = dict.__getitem__


def fake_status(html: str):
    from datetime import datetime, timezone

    return _Status(
        id=1,
        created_at=datetime(2023, 5, 2, tzinfo=timezone.utc),
        language="en",
        content=html,
        account={"id": 1},
    )


def clean_content(content: str) -> str:
    """Verbatim from coursework/.../twitter/processor.py (inline in the original)."""
    content = re.sub(r"@\w+\s*", "", content)
    content = re.sub(r"#\w+\s*", "", content)
    content = re.sub(r"https?:\/\/\S+", "", content)
    return content


def geocode_original(tw_utils, sal_dict: dict, full_name: str) -> dict:
    """The SAL matching block of twitter_processor(), verbatim (including the
    original `sal_dict.get(normalise_location)` lookup, which passes the
    function object rather than the normalised string and therefore never
    matches; the n-gram loop does the real work)."""
    normalise_location = tw_utils.normalise_location
    return_words_ngrams = tw_utils.return_words_ngrams
    sal = None
    normalised_location = normalise_location(full_name.lower())
    if sal_dict.get(normalise_location):  # noqa: original behaviour
        sal = sal_dict.get(normalise_location)
    ngram_words = return_words_ngrams(normalised_location.split(" "))
    matched = None
    for possible_location in ngram_words:
        if sal_dict.get(possible_location):
            sal = sal_dict.get(possible_location)
            matched = possible_location
            break
    return {
        "input": full_name,
        "normalised": normalised_location,
        "ngrams": ngram_words,
        "matched": matched,
        "sal": None if sal is None else str(sal),
    }


def write_json(path: Path, obj, pretty: bool = False) -> None:
    path.write_text(
        json.dumps(obj, ensure_ascii=False, indent=1 if pretty else None, separators=None if pretty else (",", ":"))
        + "\n"
    )
    log(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    sys.exit(main())
