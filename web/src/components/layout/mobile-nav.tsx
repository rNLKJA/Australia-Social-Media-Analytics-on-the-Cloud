"use client";

import { Menu } from "lucide-react";
import { IntentLink } from "@/components/layout/intent-link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function MobileNav({ items }: { items: readonly { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)]">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{SITE.name}</SheetTitle>
          <SheetDescription>{SITE.subject}, 2023</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="px-4">
          <ul className="flex flex-col gap-1">
            {[{ href: "/", label: "The story" }, ...items].map((item) => (
              <li key={item.href}>
                <IntentLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(
                    "hover:bg-muted block rounded-md px-3 py-2.5 text-base transition-colors",
                    pathname === item.href && "bg-muted font-medium",
                  )}
                >
                  {item.label}
                </IntentLink>
              </li>
            ))}
            <li>
              <a
                href={SITE.repo}
                className="text-muted-foreground hover:bg-muted block rounded-md px-3 py-2.5 text-base"
              >
                Source on GitHub
              </a>
            </li>
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
