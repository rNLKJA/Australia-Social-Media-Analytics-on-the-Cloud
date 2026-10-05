"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ items }: { items: readonly { href: string; label: string; short: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground after:absolute after:inset-x-2.5 after:-bottom-[11px] after:h-0.5 after:bg-primary",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
