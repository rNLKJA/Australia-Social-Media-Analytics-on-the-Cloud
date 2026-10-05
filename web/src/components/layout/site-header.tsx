import Link from "next/link";
import { Github } from "@/components/layout/icons";
import { LogoMark } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NAV, SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md" aria-label={`${SITE.name} home`}>
          <LogoMark className="size-7" />
          <span className="font-serif text-xl leading-none font-semibold tracking-tight">{SITE.name}</span>
        </Link>
        <NavLinks items={NAV} />
        <div className="ml-auto flex items-center gap-1">
          <a
            href={SITE.repo}
            className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            aria-label="Source code on GitHub"
            title="Source code on GitHub"
          >
            <Github className="size-4" />
          </a>
          <ThemeToggle />
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
