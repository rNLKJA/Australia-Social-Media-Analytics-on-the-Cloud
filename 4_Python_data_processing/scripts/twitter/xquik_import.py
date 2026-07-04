import argparse
import csv
import hashlib
import json
from pathlib import Path

TEXT_KEYS = ("text", "content", "tweet", "full_text", "body", "message")
AUTHOR_KEYS = ("author", "username", "screen_name", "user", "handle")
DATE_KEYS = ("created_at", "createdAt", "timestamp", "date", "published_at")
LOCATION_KEYS = ("location", "place", "full_name", "geo")
TAG_KEYS = ("tags", "hashtags", "keywords")


def rows_from_json(value):
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if isinstance(value, dict):
        for key in ("data", "results", "tweets", "items", "posts"):
            rows = value.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
        return [value]
    return []


def load_rows(path):
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return []

    if path.suffix.lower() == ".csv":
        with path.open(newline="", encoding="utf-8") as handle:
            return [dict(row) for row in csv.DictReader(handle)]

    rows = []
    if raw.startswith("{") or raw.startswith("["):
        try:
            rows.extend(rows_from_json(json.loads(raw)))
        except json.JSONDecodeError:
            rows = []

    if not rows:
        for line in raw.splitlines():
            if line.strip():
                rows.extend(rows_from_json(json.loads(line)))

    return rows


def first_string(row, keys):
    for key in keys:
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, (int, float)):
            return str(value)
    return None


def stable_id(text, author, date):
    return hashlib.sha256(f"{author}|{date}|{text}".encode("utf-8")).hexdigest()[:20]


def normalize_row(row):
    text = first_string(row, TEXT_KEYS)
    if not text:
        return None

    author = (first_string(row, AUTHOR_KEYS) or "xquik-export").lstrip("@")
    date = first_string(row, DATE_KEYS) or "Xquik export"
    tweet_id = first_string(row, ("id", "tweet_id", "tweetId", "url")) or stable_id(text, author, date)

    return {
        "tid": tweet_id,
        "author": author,
        "date": date,
        "lang": first_string(row, ("lang", "language")) or "en",
        "content": text,
        "location": first_string(row, LOCATION_KEYS),
        "sal": first_string(row, ("sal", "suburb", "area")),
        "score": row.get("score") or row.get("sentiment_score"),
        "tags": first_string(row, TAG_KEYS),
    }


def write_jsonl(rows, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    imported = 0
    skipped = 0
    with output.open("w", encoding="utf-8") as handle:
        for row in rows:
            normalized = normalize_row(row)
            if normalized:
                handle.write(json.dumps(normalized, ensure_ascii=False) + "\n")
                imported += 1
            else:
                skipped += 1
    return imported, skipped


def main():
    parser = argparse.ArgumentParser(
        description="Convert Xquik CSV, JSON, or JSONL tweet exports to the dashboard JSONL shape."
    )
    parser.add_argument("source", type=Path, help="Xquik export file")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/processed/xquik_import.jsonl"),
        help="Output JSONL file",
    )
    args = parser.parse_args()

    imported, skipped = write_jsonl(load_rows(args.source), args.output)
    print(json.dumps({"imported": imported, "skipped": skipped}, sort_keys=True))


if __name__ == "__main__":
    main()
