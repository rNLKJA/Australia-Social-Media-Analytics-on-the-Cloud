const int = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 });

export const fmtInt = (n: number) => int.format(n);
export const fmtCompact = (n: number) => compact.format(n);

/** $48,256 */
export const fmtAud = (n: number) => `$${int.format(n)}`;

/** 48.3k AUD style used in the team report */
export const fmtAudK = (n: number) => `$${(n / 1000).toFixed(1)}k`;

export const fmtPct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

/** Sentiment on the 1-9 scale */
export const fmtScore = (x: number | null | undefined, digits = 2) =>
  x === null || x === undefined || Number.isNaN(x) ? "–" : x.toFixed(digits);

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return "–";
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`;
}

export function fmtR(r: number): string {
  const a = Math.abs(r).toFixed(2);
  return (r < 0 && a !== "0.00" ? "−" : "") + a;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${fmtInt(n)} ${n === 1 ? one : many}`;
}
