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

/**
 * Horizontal bars with labels; server-rendered, accessible as a list. Every
 * row uses the same fixed label and value columns so bar lengths compare and
 * the numbers right-align.
 */
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
        <li
          key={it.key}
          className="grid grid-cols-[minmax(7rem,11rem)_1fr_4.5rem] items-center gap-3 text-sm lg:grid-cols-[minmax(9rem,16rem)_1fr_4.5rem]"
        >
          <span
            className={cn("text-muted-foreground truncate", it.highlight && "text-foreground font-medium")}
            title={it.label}
          >
            {it.label}
          </span>
          <span className="bg-muted relative h-2.5 rounded-full" aria-hidden>
            <span
              className="absolute inset-y-0 left-0 rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_20%,transparent)]"
              style={{
                width: `${Math.max(0.5, (it.value / m) * 100)}%`,
                background: it.color ?? "var(--chart-1)",
              }}
            />
          </span>
          <span
            className={cn("num text-muted-foreground text-right text-xs", it.highlight && "text-foreground")}
          >
            {it.display ?? it.value}
            {it.note && <span className="sr-only"> ({it.note})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
