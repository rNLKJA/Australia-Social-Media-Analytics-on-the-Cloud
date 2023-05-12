import re
from itertools import combinations

class Tweet:
    def __init__(self, tid=None, author=None, date=None, content=None, 
                 location=None, sal=None, tags=None):
        self.tid = tid
        self.author = author
        self.date = date
        self.content = content
        self.location = location
        self.sal = sal
        self.tags = tags

    def __repr__(self):
        return f"Twitter(tid={self.tid}, author={self.author}, date={self.date}, content={self.content}, " \
               f"location={self.location}, sal={self.sal}, tags={self.tags}"

    def to_dict(self):
        return {
            'tid': self.tid,
            'author': self.author,
            'date': self.date,
            'content': self.content,
            'location': self.location,
            'sal': self.suburb
        }

    def data_complete(self):
        return self.tid is not None and self.author is not None and self.date is not None and self.content is not None

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