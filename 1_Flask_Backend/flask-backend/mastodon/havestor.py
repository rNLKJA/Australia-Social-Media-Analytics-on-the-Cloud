import os
from dotenv import load_dotenv
from datetime import datetime
from bs4 import BeautifulSoup

from mastodon import Mastodon
from utils.sentiment_analyser import normalize_string, sentiment_analysis


def extract_mastodon_info(res):
    toot_id = res.id
    date = res.created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    lang = res.language
    content = normalize_string(BeautifulSoup(res.content, 'html.parser').text)
    score = sentiment_analysis(content)
    tags = "|".join(res.tags)
    
    return Toot(tid=toot_id, date=date, lang=lang, content=content, score=score, tags=tags)
