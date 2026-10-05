import { cn } from "@/lib/utils";

export interface BarItem {
  key: string;
  label: string;
  value: number;
  display?: string;
  color?: string;
  highlight?: boolean;
  note?: string;
}

/** Horizontal bars with labels; server-rendered, accessible as a list. */
export function BarList({
  items,
  max,
  className,
  ariaLabel,
}: {
  items: BarItem[];
  max?: number;
  className?: string;
  ariaLabel: string;
}) {
  const m = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn("space-y-2", className)} aria-label={ariaLabel}>
      {items.map((it) => (
        <li key={it.key} className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3 text-sm">
          <span className={cn("truncate text-muted-foreground", it.highlight && "font-medium text-foreground")} title={it.label}>
            {it.label}
          </span>
          <span className="relative h-2.5 rounded-full bg-muted" aria-hidden>
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.max(0.5, (it.value / m) * 100)}%`, background: it.color ?? "var(--chart-1)" }}
            />
          </span>
          <span className={cn("num text-right text-xs text-muted-foreground", it.highlight && "text-foreground")}>
            {it.display ?? it.value}
            {it.note && <span className="sr-only"> ({it.note})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
