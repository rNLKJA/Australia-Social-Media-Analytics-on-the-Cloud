"use client";

import { cn } from "@/lib/utils";

/** A compact single-choice toggle group (buttons with aria-pressed). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap rounded-md border border-border bg-card p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            value === o.value && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
