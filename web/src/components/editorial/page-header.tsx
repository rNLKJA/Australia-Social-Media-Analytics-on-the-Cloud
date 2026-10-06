import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  lede,
  children,
  className,
}: {
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-border relative border-b", className)}>
      <div className="grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 md:pt-20">
        <p className="kicker">{kicker}</p>
        <h1 className="text-title mt-3 max-w-4xl font-serif font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {lede && <p className="text-lede text-muted-foreground mt-5 max-w-3xl text-pretty">{lede}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </header>
  );
}

export function Section({
  id,
  kicker,
  title,
  intro,
  children,
  className,
}: {
  id?: string;
  kicker?: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6", className)}>
      {kicker && <p className="kicker">{kicker}</p>}
      <h2 className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {title}
      </h2>
      {intro && <div className="prose-civic text-muted-foreground mt-4">{intro}</div>}
      {children && <div className="mt-8">{children}</div>}
    </section>
  );
}

export interface Stat {
  value: string;
  label: string;
  note?: string;
}

export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn(
        "border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4",
        className,
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="bg-card px-4 py-4">
          <dt className="text-muted-foreground text-xs">{s.label}</dt>
          <dd className="num mt-1 font-serif text-2xl font-semibold tracking-tight md:text-3xl">{s.value}</dd>
          {s.note && <dd className="text-muted-foreground mt-0.5 text-[11px]">{s.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A boxed note quoting or paraphrasing the 2023 team report. */
export function Finding({
  title = "What the team found in 2023",
  source,
  children,
  className,
}: {
  title?: string;
  source?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "border-primary bg-card rounded-lg border-l-4 p-5 shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      <p className="kicker">{title}</p>
      <div className="prose-civic mt-2 text-[0.98rem]">{children}</div>
      {source && <p className="text-muted-foreground mt-3 text-xs">{source}</p>}
    </aside>
  );
}

export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-muted-foreground text-xs leading-relaxed", className)}>{children}</p>;
}
