import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-10 font-serif text-3xl font-semibold tracking-tight">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 font-serif text-2xl font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-8 font-serif text-xl font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mt-4 leading-[1.7]">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6 leading-[1.65]">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6 leading-[1.65]">{children}</ol>,
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link className="link" href={href}>
        {children}
      </Link>
    ) : (
      <a className="link" href={href}>
        {children}
      </a>
    ),
  code: ({ children }) => (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere]">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <ScrollRegion
      label="Table (scrolls sideways)"
      className="border-border bg-card relative my-5 rounded-lg border"
    >
      <table className="w-full text-sm">{children}</table>
    </ScrollRegion>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/60 text-muted-foreground text-left text-xs">{children}</thead>
  ),
  th: ({ children, style }) => (
    <th className="px-3 py-2 font-medium" style={style}>
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td className="num border-border/70 border-t px-3 py-1.5" style={style}>
      {children}
    </td>
  ),
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
};

/** Render the repository's markdown documents in the site's editorial style (server component). */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("text-foreground/90 max-w-[72ch] text-[1.02rem]", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
