"use client";

import { IntentLink } from "@/components/layout/intent-link";
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
              <IntentLink
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:text-foreground relative rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active &&
                    "text-foreground after:bg-primary after:absolute after:inset-x-2.5 after:-bottom-[11px] after:h-0.5",
                )}
              >
                <span className="xl:hidden">{item.short}</span>
                <span className="hidden xl:inline">{item.label}</span>
              </IntentLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
