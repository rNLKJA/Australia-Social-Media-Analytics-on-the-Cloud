import { IntentLink } from "@/components/layout/intent-link";
import { LogoMark } from "@/components/layout/logo";
import { NAV, SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-border bg-muted/40 mt-24 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LogoMark className="size-6" />
            <span className="font-serif text-lg font-semibold">{SITE.name}</span>
          </div>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            {SITE.subject}, {SITE.university}, {SITE.term}. Built by {SITE.team} on the Melbourne Research
            Cloud; revived in 2026 as a read-only web app, with uncertainty, spatial statistics and optional
            bring-your-own-key AI added in the upgrade. The original submission is preserved in the
            repository.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="kicker mb-3">Explore</h2>
          <ul className="space-y-1.5 text-sm">
            <li>
              <IntentLink className="text-muted-foreground hover:text-foreground" href="/">
                The story
              </IntentLink>
            </li>
            {NAV.map((n) => (
              <li key={n.href}>
                <IntentLink className="text-muted-foreground hover:text-foreground" href={n.href}>
                  {n.label}
                </IntentLink>
              </li>
            ))}
            <li>
              <IntentLink className="text-muted-foreground hover:text-foreground" href="/ask/eval">
                Text-to-SQL evaluation
              </IntentLink>
            </li>
            <li>
              <IntentLink className="text-muted-foreground hover:text-foreground" href="/ai-log">
                AI audit log (this browser)
              </IntentLink>
            </li>
            <li>
              <IntentLink className="text-muted-foreground hover:text-foreground" href="/methods#decisions">
                Decision records
              </IntentLink>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="kicker mb-3">Sources</h2>
          <ul className="text-muted-foreground space-y-1.5 text-sm">
            <li>Twitter corpus via the Australian Data Observatory (aggregates only)</li>
            <li>Mastodon public timelines: mastodon.social, mastodon.au, tictoc.social</li>
            <li>SUDO / ABS personal income; Crime Statistics Agency Victoria</li>
            <li>ABS boundaries (CC BY 4.0); basemap © OpenStreetMap, OpenFreeMap</li>
            <li>
              <a className="link" href={SITE.repo}>
                github.com/rNLKJA/Australia-Social-Media-Analytics-on-the-Cloud
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
