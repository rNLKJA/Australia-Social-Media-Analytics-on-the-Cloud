/**
 * Colour scales for maps and charts. Hex values mirror the CSS tokens in
 * app/globals.css (`--sent-*`, `--seq-*`) because MapLibre paint properties
 * need concrete colours.
 */
export type ThemeName = "light" | "dark";

export const SENTIMENT: Record<ThemeName, string[]> = {
  light: ["#a63a24", "#c8553d", "#e07a5f", "#efb09a", "#e4dccd", "#a7d3cb", "#6bb3a8", "#2e8c82", "#0f625c"],
  dark: ["#f2876b", "#dc6c53", "#b45a47", "#7a4a3f", "#3b3935", "#2d5d57", "#2f857c", "#3fae9f", "#6fd3c4"],
};

export const SEQUENTIAL: Record<ThemeName, string[]> = {
  light: ["#f0edf6", "#d9d2ea", "#b8abd6", "#9483c0", "#715ea7", "#503f8a", "#33276a"],
  dark: ["#222033", "#332e55", "#463f78", "#5b5398", "#7a70b6", "#a196d3", "#d0c7f0"],
};

export const NO_DATA: Record<ThemeName, string> = { light: "#d9d3c8", dark: "#2a2c30" };

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

/** Quantile class breaks (k classes => k-1 internal breaks). */
export function quantileBreaks(values: number[], k: number): number[] {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return [];
  const out: number[] = [];
  for (let i = 1; i < k; i++) {
    const pos = (xs.length - 1) * (i / k);
    const lo = Math.floor(pos);
    out.push(xs[lo] + (xs[Math.ceil(pos)] - xs[lo]) * (pos - lo));
  }
  return out;
}

export function classify(value: number, breaks: number[]): number {
  let c = 0;
  while (c < breaks.length && value > breaks[c]) c++;
  return c;
}

export function sequentialColor(value: number, breaks: number[], theme: ThemeName = "light"): string {
  const pal = SEQUENTIAL[theme];
  const k = breaks.length + 1;
  const c = classify(value, breaks);
  // spread k classes over the 7-step palette
  const idx = k === 1 ? pal.length - 1 : Math.round((c / (k - 1)) * (pal.length - 1));
  return pal[idx];
}
