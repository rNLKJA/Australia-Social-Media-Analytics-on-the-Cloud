import Link from "next/link";
import { NAV } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="kicker">404 · no data for this region</p>
      <h1 className="mt-3 font-serif text-title font-semibold tracking-tight">This page scored a 5: nothing here.</h1>
      <p className="mt-4 text-lede text-muted-foreground">
        The address does not match any page. Try one of these instead:
      </p>
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {[{ href: "/", label: "The story" }, ...NAV].map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              className="block rounded-lg border border-border bg-card px-4 py-3 font-medium transition-colors hover:border-primary/60"
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
