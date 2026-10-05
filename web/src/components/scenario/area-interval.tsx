import { AlertTriangle } from "lucide-react";
import { fmtScore } from "@/lib/format";
import { areaMean, MIN_TWEETS_RELIABLE } from "@/lib/stats";
import type { ScoreSums } from "@/lib/types";

/** A region's 95% interval for its average score, flagged when it rests on few tweets (DR-003). */
export function AreaInterval({ sums }: { sums: ScoreSums | null | undefined }) {
  if (!sums || sums.n === 0) return null;
  const m = areaMean(sums);
  return (
    <>
      <span className="num block">
        {m.lower === null ? "one tweet: no interval" : `95% CI ${fmtScore(m.lower)}–${fmtScore(m.upper)}`}
      </span>
      {sums.n < MIN_TWEETS_RELIABLE && (
        <span className="text-sent-neg flex items-center gap-1">
          <AlertTriangle className="size-3" aria-hidden /> under {MIN_TWEETS_RELIABLE} tweets: low reliability
        </span>
      )}
    </>
  );
}
