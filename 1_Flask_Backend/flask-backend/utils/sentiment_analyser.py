import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.stem import WordNetLemmatizer

import os
from dotenv import load_dotenv

nltk.download('vader_lexicon')
nltk.download('wordnet')
nltk.download('punkt')

load_dotenv()

def normalize_string(input_string):
    lemmatizer = WordNetLemmatizer()
    tokens = nltk.word_tokenize(input_string)
    normalized_tokens = [lemmatizer.lemmatize(token) for token in tokens]
    normalized_string = ' '.join(normalized_tokens)
    return normalized_string

def sentiment_analysis(text):
    sia = SentimentIntensityAnalyzer()
    sentiment = sia.polarity_scores(text)
    compound_score = sentiment['compound']
    
    if compound_score <= -0.8:
        return 1
    elif -0.8 < compound_score <= -0.6:
        return 2
    elif -0.6 < compound_score <= -0.4:
        return 3
    elif -0.4 < compound_score <= -0.2:
        return 4
    elif -0.2 < compound_score < 0.2:
        return 5
    elif 0.2 <= compound_score < 0.4:
        return 6
    elif 0.4 <= compound_score < 0.6:
        return 7
    elif 0.6 <= compound_score < 0.8:
        return 8
    else:
        return 9