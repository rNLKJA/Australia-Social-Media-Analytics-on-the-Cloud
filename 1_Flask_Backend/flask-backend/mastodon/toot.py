import os
from dotenv import load_dotenv

class Toot:
    def __init__(self, tid=None, date=None, author=None, 
                 lang=None, content=None, score=None, tags=None):
        self.tid = tid
        self.date = date
        self.author = author
        self.lang = lang
        self.content = content
        self.score = score
        self.tags = tags
        
    def __repr__(self):
        return f"Toot {self.tid}"
        
    def to_dict(self):
        data = dict(tid=self.tid, date=self.date,
                    author=self.author, lang=self.lang,
                    content=content.self.content, score=self.score)
        return data