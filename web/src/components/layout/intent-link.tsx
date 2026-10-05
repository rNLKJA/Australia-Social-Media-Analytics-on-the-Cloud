"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A Link that prefetches on intent (hover, focus or touch) instead of when it
 * scrolls into view. The header and footer link to every route, and several
 * pages carry their whole dataset in the RSC payload, so viewport prefetching
 * would download ~1 MB on every page view.
 */
export function IntentLink({
  href,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const prefetch = () => {
    if (typeof href === "string") router.prefetch(href);
  };
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        prefetch();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        prefetch();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        prefetch();
        onTouchStart?.(e);
      }}
      {...props}
    />
  );
}
