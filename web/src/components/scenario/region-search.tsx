"use client";

import { Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface SearchItem {
  code: string;
  name: string;
  hint?: string;
}

/** Accessible region finder: type to filter, arrow keys to move, Enter to pick. */
export function RegionSearch({
  items,
  onPick,
  placeholder = "Find a region",
  className,
}: {
  items: SearchItem[];
  onPick: (code: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const starts = items.filter((i) => i.name.toLowerCase().startsWith(s));
    const contains = items.filter(
      (i) => !i.name.toLowerCase().startsWith(s) && i.name.toLowerCase().includes(s),
    );
    return [...starts, ...contains].slice(0, 8);
  }, [q, items]);

  const pick = (code: string) => {
    onPick(code);
    setQ("");
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        {placeholder}
      </label>
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && matches[active]) {
            e.preventDefault();
            pick(matches[active].code);
          } else if (e.key === "Escape") {
            setQ("");
            setOpen(false);
          }
        }}
        className="border-input bg-card placeholder:text-muted-foreground focus-visible:ring-ring/40 h-9 w-full rounded-md border pr-8 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
      {q && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQ("")}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      {open && matches.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="border-border bg-popover absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border p-1 shadow-lg"
        >
          {matches.map((m, i) => (
            <li
              key={m.code}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m.code);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-3 rounded px-2 py-1.5 text-sm",
                i === active && "bg-accent",
              )}
            >
              <span>{m.name}</span>
              {m.hint && <span className="num text-muted-foreground text-xs">{m.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
