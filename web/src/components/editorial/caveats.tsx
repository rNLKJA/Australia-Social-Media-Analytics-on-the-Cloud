import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function CaveatBox({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn("border-sent-neg/50 bg-card rounded-lg border border-l-4 p-4", className)}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <AlertTriangle className="text-sent-neg-ink size-4" aria-hidden />
        {title}
      </p>
      <div className="text-muted-foreground mt-1.5 space-y-2 text-sm leading-relaxed">{children}</div>
    </aside>
  );
}

/**
 * The two caveats every area-level comparison on this site carries: the
 * ecological fallacy and the modifiable areal unit problem.
 */
export function AreaCaveats({ unit, className }: { unit: "SA2" | "LGA" | "area"; className?: string }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      <CaveatBox title="Ecological fallacy">
        <p>
          These are {unit === "area" ? "area" : unit} averages. A link between an area&apos;s income or
          recorded crime and the average tone of tweets placed there says nothing about whether richer people,
          or people who experienced crime, tweet differently. Tweeters are not a sample of residents, and a
          tweet tagged to a place need not come from someone who lives there.
        </p>
      </CaveatBox>
      <CaveatBox title="Modifiable areal unit problem (MAUP)">
        <p>
          Results depend on where the boundaries fall and how coarse they are. The same tweets pooled to
          suburbs, SA2s or LGAs give different correlations and different spatial patterns, and tweets were
          geocoded to 2021 suburbs while income uses 2016 SA2s and crime 2019 LGAs. See the{" "}
          <Link className="link" href="/spatial#sensitivity">
            sensitivity table
          </Link>{" "}
          for how much the answer moves.
        </p>
      </CaveatBox>
    </div>
  );
}
