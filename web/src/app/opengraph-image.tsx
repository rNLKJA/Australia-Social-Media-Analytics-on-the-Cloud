import { ImageResponse } from "next/og";

export const alt =
  "Social Sense: how Victoria felt online, revisited. COMP90024, University of Melbourne, 2023.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SENT = [
  "#a63a24",
  "#c8553d",
  "#e07a5f",
  "#efb09a",
  "#e4dccd",
  "#a7d3cb",
  "#6bb3a8",
  "#2e8c82",
  "#0f625c",
];
// Twitter sentiment distribution (share of 2,418,617 geotagged tweets per score 1-9)
const SHARES = [1.6, 3.3, 5.5, 5.0, 47.9, 7.8, 13.3, 10.0, 5.6];

export default function Image() {
  const max = Math.max(...SHARES);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f7f4ee",
        color: "#1c1a17",
        padding: "64px 72px",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: 4,
            color: "#1d3a5f",
            fontFamily: "sans-serif",
            fontWeight: 700,
          }}
        >
          SOCIAL SENSE · COMP90024 · 2023
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.05, marginTop: 24, maxWidth: 900, fontWeight: 700 }}>
          Does the mood online match life on the ground?
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div
          style={{ display: "flex", fontSize: 26, color: "#5d574e", fontFamily: "sans-serif", maxWidth: 560 }}
        >
          2.4M geotagged tweets and 1.7M toots, scored and set against income and crime in Victoria.
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180 }}>
          {SHARES.map((s, i) => (
            <div
              key={i}
              style={{ width: 44, height: (s / max) * 180, background: SENT[i], borderRadius: 4 }}
            />
          ))}
        </div>
      </div>
    </div>,
    size,
  );
}
