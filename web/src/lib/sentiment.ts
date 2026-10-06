/**
 * analyzer.py `sentiment_analysis` / `sentiment_description`: map VADER's
 * compound score (already rounded to 4 dp by VADER) onto the team's 1-9 scale.
 */
export type SentimentBucket = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const SENTIMENT_BUCKETS: SentimentBucket[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function sentimentBucket(compound: number): SentimentBucket {
  if (compound <= -0.8) return 1;
  else if (-0.8 < compound && compound <= -0.6) return 2;
  else if (-0.6 < compound && compound <= -0.4) return 3;
  else if (-0.4 < compound && compound <= -0.2) return 4;
  else if (-0.2 < compound && compound < 0.2) return 5;
  else if (0.2 <= compound && compound < 0.4) return 6;
  else if (0.4 <= compound && compound < 0.6) return 7;
  else if (0.6 <= compound && compound < 0.8) return 8;
  return 9;
}

const DESCRIPTIONS: Record<SentimentBucket, string> = {
  1: "Extremely Negative",
  2: "Very Strongly Negative",
  3: "Strongly Negative",
  4: "Negative",
  5: "Neutral",
  6: "Positive",
  7: "Strongly Positive",
  8: "Very Strongly Positive",
  9: "Extremely Positive",
};

export function sentimentDescription(score: number): string {
  return DESCRIPTIONS[score as SentimentBucket] ?? "Invalid score";
}

/** The compound-score interval each bucket covers (for legends and docs). */
export const BUCKET_RANGES: Record<SentimentBucket, string> = {
  1: "≤ −0.8",
  2: "−0.8 to −0.6",
  3: "−0.6 to −0.4",
  4: "−0.4 to −0.2",
  5: "−0.2 to 0.2",
  6: "0.2 to 0.4",
  7: "0.4 to 0.6",
  8: "0.6 to 0.8",
  9: "≥ 0.8",
};
