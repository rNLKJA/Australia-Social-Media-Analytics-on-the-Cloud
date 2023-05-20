class Toot:
    def __init__(self, tid=None, date=None, author=None, 
                 lang=None, content=None, score=None):
        self.tid = tid
        self.date = date
        self.author = author
        self.lang = lang
        self.content = content
        self.score = score
        
    def __repr__(self):
        return f"Toot {self.tid}"
        
    def to_dict(self):
        data = dict(tid=self.tid, date=self.date,
                    author=self.author, lang=self.lang,
                    content=self.content, score=self.score)
        return data

def extract_mastodon_info(res):
    toot_id = res.id
    date = res.created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    lang = res.language
    content = normalize_string(BeautifulSoup(res.content, 'html.parser').text)
    score = sentiment_analysis(content)
    
    return Toot(tid=toot_id, date=date, lang=lang, content=content, score=score)