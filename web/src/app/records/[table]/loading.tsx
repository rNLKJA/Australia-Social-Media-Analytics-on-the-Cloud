export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-busy="true" aria-live="polite">
      <div className="bg-muted h-3 w-24 animate-pulse rounded" />
      <div className="bg-muted mt-4 h-10 w-2/3 animate-pulse rounded" />
      <div className="mt-10 space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="bg-muted/70 h-7 animate-pulse rounded" />
        ))}
      </div>
      <span className="sr-only">Loading table…</span>
    </div>
  );
}
