import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** The visible label every AI output carries. */
export function AiGeneratedLabel({ model, className }: { model?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-600/40 bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      AI-generated{model ? <span className="font-mono font-normal opacity-80">· {model}</span> : null}
    </span>
  );
}
