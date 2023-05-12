from itertools import combinations
import re
import pickle
from pathlib import Path

def generate_item(twid, author, created_time, text_content, location, gcc):
    item = {
        "_id": twid.group(1),
        "author_id": author.group(1),
        "created_at": created_time.group(1),
        "text": text_content.group(1),
        "location": location,
        "possible_suburb": gcc,
    }
    return item

def return_words_ngrams(words: list) -> list:
    """
    Return a list containing ngram words
    """
    return [
        " ".join(c) for i in range(1, len(words) + 1) for c in combinations(words, i)
    ]

def normalise_location(location: str) -> str:
    """
    Normalise location by removing punctuation and extra white spaces.
    """
    text = re.sub(r"[^\w\s]", "", location)
    text = re.sub(r" - ", "", text)

    if location.split(",")[0] in gccs:
        text = location.split(",")[0].lower()

    for key, value in state_location.items():
        text = re.sub(key, value, text)

    return re.sub(" +", " ", text)

# List of major cities
gccs = [
    "Canberra",
    "Sydney",
    "Darwin",
    "Brisbane",
    "Adelaide",
    "Hobart",
    "Melbourne",
    "Perth",
]

# State and abbreviation dictionary
state_location = dict(
    zip(
        [s.lower() for s in [
            "Australian Capital Territory",
            "New South Wales",
            "Northern Territory",
            "Queensland",
            "South Australia",
            "Tasmania",
            "Victoria",
            "Western Australia",
        ]],
        [s.lower() for s in ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]],
    )
)

INVALID_LOCATION = [
    "act australia",
    "nsw australia",
    "nt australia",
    "qld Australia",
    "sa australia",
    "tas australia",
    "vic australia",
    "wa australia",
    "australia",
]

def load_pickle_object(path: Path) -> object:
    """
    Load pickle object from path
    """
    with open(path, "rb") as f:
        return pickle.load(f)

