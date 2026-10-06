import { AiSettingsDialog } from "@/components/ai/ai-settings-dialog";
import { IntentLink } from "@/components/layout/intent-link";
import { Github } from "@/components/layout/icons";
import { LogoMark } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NAV, SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-border/80 bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur-md">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <IntentLink
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md"
          aria-label={`${SITE.name} home`}
        >
          <LogoMark className="size-7" />
          <span className="font-serif text-xl leading-none font-semibold tracking-tight">{SITE.name}</span>
        </IntentLink>
        <NavLinks items={NAV} />
        <div className="ml-auto flex items-center gap-1">
          <a
            href={SITE.repo}
            className="text-muted-foreground hover:text-foreground hidden rounded-md p-2 transition-colors sm:inline-flex"
            aria-label="Source code on GitHub"
            title="Source code on GitHub"
          >
            <Github className="size-4" />
          </a>
          <AiSettingsDialog />
          <ThemeToggle />
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
