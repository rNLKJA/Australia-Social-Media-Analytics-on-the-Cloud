"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="kicker">Something went wrong</p>
      <h1 className="mt-3 font-serif text-title font-semibold tracking-tight">This view failed to load.</h1>
      <p className="mt-4 text-lede text-muted-foreground">
        The data behind this page could not be read. It is a read-only snapshot, so trying again usually works.
        {error.digest && <span className="mt-2 block font-mono text-xs">Reference: {error.digest}</span>}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to the story</Link>
        </Button>
      </div>
    </div>
  );
}
