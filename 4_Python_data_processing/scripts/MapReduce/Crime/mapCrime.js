function (doc) {
  const crime_words = ["crime", "police", "theft", "robbery", "smuggl", "arrest", "kidnap",
  "homicide", "murder", "offence", "violence", "money laund"];
  var content = doc.content.toLowerCase();
  var crime_mentioned = false;
  for (var crime_word of crime_words) {
    if (content.includes(crime_word)) {
      crime_mentioned = true;
      break;
    }
  }
  var title;
  if (crime_mentioned) {
    title = "CrimeMentioned";
  } else {
    title = "CrimeAbsent";
  }
  
  emit([title, doc.sal, doc._id, doc.content], doc.score);
}