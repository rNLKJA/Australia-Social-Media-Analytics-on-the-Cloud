function (doc) {
    const crime_words = ["crime", "criminal", "police", "theft", "robbery", "smuggl", "arrest", "kidnap",
    "homicide", "murder", "offence", "violence", "money laund"];
    var content = doc.content.toLowerCase();
    for (var crime_word of crime_words) {
      if (content.includes(crime_word)) {
        emit([doc.sal, doc.content, doc._id], doc.score);
        break;
      }
    }
  }