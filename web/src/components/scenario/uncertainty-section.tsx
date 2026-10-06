import Link from "next/link";
import { AreaCaveats } from "@/components/editorial/caveats";
import { Section } from "@/components/editorial/page-header";
import { RelationshipFigures, RelationshipNote } from "@/components/spatial/relationship-figures";
import type { RelationshipResult } from "@/lib/spatial-analysis";

/**
 * The 2026 rigour layer on a scenario page: the same comparison with a
 * bootstrap interval, a robust slope, a residual spatial check and the area
 * caveats. Adds to the 2023 analysis above it; changes none of it.
 */
export function UncertaintySection({
  unitName,
  items,
}: {
  unitName: "SA2" | "LGA";
  items: { title: string; note: string; res: RelationshipResult }[];
}) {
  return (
    <Section
      id="uncertainty"
      kicker="2026 upgrade · uncertainty"
      title="How sure can we be?"
      intro={
        <p>
          The correlations above are point estimates. Here the same comparison carries a 95% interval, a
          heteroskedasticity-robust slope and a check for leftover spatial structure, first at the 2023
          threshold and then counting only {unitName}s with at least 30 tweets, where an average can bear some
          weight.
        </p>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className="border-border bg-card space-y-3 rounded-lg border p-5">
            <div>
              <h3 className="font-serif text-xl font-semibold">{it.title}</h3>
              <p className="text-muted-foreground text-xs">{it.note}</p>
            </div>
            <RelationshipFigures res={it.res} showNote={false} />
          </div>
        ))}
      </div>
      {items[0] && (
        <div className="mt-4 max-w-4xl">
          <RelationshipNote res={items[0].res} />
        </div>
      )}
      <AreaCaveats unit={unitName} className="mt-6" />
      <p className="mt-6 text-sm">
        <Link className="link" href="/spatial">
          Spatial statistics: clusters, suppression and the full sensitivity table →
        </Link>
      </p>
    </Section>
  );
}
