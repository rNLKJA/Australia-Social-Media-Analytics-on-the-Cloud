"use client";

import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const PRESETS = [1, 5, 10, 30];

/** Minimum number of topic tweets a region needs to enter the fit. */
export function ThresholdControl({
  value,
  onChange,
  max = 50,
  label = "Minimum tweets per region",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  label?: string;
  className?: string;
}) {
  const labelId = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="text-xs font-medium">
          {label}
        </span>
        <span className="num text-muted-foreground text-xs">≥ {value}</span>
      </div>
      <Slider
        aria-labelledby={labelId}
        getAriaValueText={(v) => `at least ${v} tweet${v === 1 ? "" : "s"}`}
        min={1}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={value === p}
            aria-label={`At least ${p} tweet${p === 1 ? "" : "s"}`}
            className={cn(
              "num border-border text-muted-foreground hover:text-foreground rounded border px-2 py-0.5 text-[11px] transition-colors",
              value === p &&
                "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
