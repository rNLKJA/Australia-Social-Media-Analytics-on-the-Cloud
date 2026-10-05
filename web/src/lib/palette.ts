/**
 * Colour scales for maps and charts. Hex values mirror the CSS tokens in
 * app/globals.css (`--sent-*`, `--seq-*`) because MapLibre paint properties
 * need concrete colours.
 */
export type ThemeName = "light" | "dark";

export const SENTIMENT: Record<ThemeName, string[]> = {
  light: ["#a63a24", "#c8553d", "#e07a5f", "#efb09a", "#e4dccd", "#a7d3cb", "#6bb3a8", "#2e8c82", "#0f625c"],
  // Dark: the neutral midpoint is a visible mid-tone (>= 3:1 against the card)
  // rather than a near-black, so "scored 5" never reads as "no data".
  dark: ["#f2876b", "#dc6c53", "#bf5f4b", "#a0675a", "#6f6a62", "#4e8078", "#3f998d", "#4fb7a8", "#6fd3c4"],
};

export const SEQUENTIAL: Record<ThemeName, string[]> = {
  light: ["#f0edf6", "#d9d2ea", "#b8abd6", "#9483c0", "#715ea7", "#503f8a", "#33276a"],
  dark: ["#222033", "#332e55", "#463f78", "#5b5398", "#7a70b6", "#a196d3", "#d0c7f0"],
};

/**
 * No-data regions are drawn as a hatch (diagonal lines in this colour over a
 * faint tint), never as a flat fill, so they cannot be mistaken for the
 * neutral midpoint of the sentiment scale.
 */
export const NO_DATA: Record<ThemeName, string> = { light: "#a9a090", dark: "#5a5e66" };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Continuous colour for a 1-9 sentiment value (stops at each integer). */
export function sentimentColor(value: number, theme: ThemeName = "light"): string {
  const stops = SENTIMENT[theme];
  const v = Math.min(9, Math.max(1, value));
  const i = Math.min(7, Math.floor(v - 1));
  return mix(stops[i], stops[i + 1], v - 1 - i);
}

/**
 * Diverging colour centred on `mid` that saturates at mid +/- spread. Useful
 * for regional averages, which mostly sit between 4 and 7.
 */
export function divergingColor(
  value: number,
  mid: number,
  spread: number,
  theme: ThemeName = "light",
): string {
  const t = Math.max(-1, Math.min(1, (value - mid) / spread));
  return sentimentColor(5 + t * 4, theme);
}

/**
 * Quantile class breaks (k classes => at most k-1 internal breaks). Repeated
 * breaks are dropped, because a class bounded by two equal breaks can never
 * hold a value: skewed counts (most suburbs with 1 tweet) yield fewer classes.
 */
export function quantileBreaks(values: number[], k: number): number[] {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return [];
  const out: number[] = [];
  for (let i = 1; i < k; i++) {
    const pos = (xs.length - 1) * (i / k);
    const lo = Math.floor(pos);
    const b = xs[lo] + (xs[Math.ceil(pos)] - xs[lo]) * (pos - lo);
    if (!out.length || b > out[out.length - 1]) out.push(b);
  }
  return out;
}

export function classify(value: number, breaks: number[]): number {
  let c = 0;
  while (c < breaks.length && value > breaks[c]) c++;
  return c;
}

/** Colour of class `c` when `k` classes are spread over the 7-step palette. */
function classColor(c: number, k: number, theme: ThemeName): string {
  const pal = SEQUENTIAL[theme];
  const idx = k === 1 ? pal.length - 1 : Math.round((c / (k - 1)) * (pal.length - 1));
  return pal[idx];
}

export function sequentialColor(value: number, breaks: number[], theme: ThemeName = "light"): string {
  return classColor(classify(value, breaks), breaks.length + 1, theme);
}

/** The colours actually used for each class (for the legend). */
export function sequentialClassColors(breaks: number[], theme: ThemeName = "light"): string[] {
  const k = breaks.length + 1;
  return Array.from({ length: k }, (_, c) => classColor(c, k, theme));
}
