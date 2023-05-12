import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk.stem import WordNetLemmatizer

nltk.download('vader_lexicon')
nltk.download('wordnet')
nltk.download('punkt')

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


def sentiment_description(score):
    sentiment_dict = {
        1: "Extremely Negative",
        2: "Very Strongly Negative",
        3: "Strongly Negative",
        4: "Negative",
        5: "Neutral",
        6: "Positive",
        7: "Strongly Positive",
        8: "Very Strongly Positive",
        9: "Extremely Positive"
    }
    
    return sentiment_dict.get(score, "Invalid score")