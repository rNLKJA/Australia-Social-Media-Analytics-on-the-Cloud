/** Wordmark glyph: a split disc, coral (negative) to teal (positive). */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <circle cx="16" cy="16" r="15" fill="var(--sent-5)" />
      <path d="M16 1a15 15 0 0 0 0 30z" fill="var(--sent-2)" />
      <path d="M16 1a15 15 0 0 1 0 30z" fill="var(--sent-8)" />
      <path d="M9 19.5c2.2 2.4 4.4 3.5 7 3.5s4.8-1.1 7-3.5" fill="none" stroke="var(--background)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="11" cy="12.5" r="1.8" fill="var(--background)" />
      <circle cx="21" cy="12.5" r="1.8" fill="var(--background)" />
    </svg>
  );
}
