import type { Metadata } from "next";
import Link from "next/link";
import { NAV } from "@/lib/site";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="kicker">404 · no data for this region</p>
      <h1 className="text-title mt-3 font-serif font-semibold tracking-tight">
        This page scored a 5: nothing here.
      </h1>
      <p className="text-lede text-muted-foreground mt-4">
        The address does not match any page. Try one of these instead:
      </p>
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {[{ href: "/", label: "The story" }, ...NAV].map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              className="border-border bg-card hover:border-primary/60 block rounded-lg border px-4 py-3 font-medium transition-colors"
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
