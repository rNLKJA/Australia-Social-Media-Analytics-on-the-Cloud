import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A horizontally scrollable wrapper (wide tables on phones) that keyboard users
 * can focus and scroll with the arrow keys, even when it holds nothing
 * focusable itself (WCAG 2.1.1; axe "scrollable-region-focusable").
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  /** what the region holds, read out when it takes focus */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "focus-visible:ring-ring/50 overflow-x-auto focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
