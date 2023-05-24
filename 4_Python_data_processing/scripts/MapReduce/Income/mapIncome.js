function (doc) {
    const income_words = ["salary", "income", "housing", "mortgage", "liability", "debt", 
    "expensive", "afford", "job", "work", "strike", "compensation", "luxur", "finance",
    "financial", "equality", "fairness", "inequal", "unfair"];
    var content = doc.content.toLowerCase();
    for (var income_word of income_words) {
      if (content.includes(income_word)) {
        emit([doc.sal, doc.content, doc._id], doc.score);
        break;
      }
    }
  }