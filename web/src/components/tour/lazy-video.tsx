"use client";

import { useEffect, useRef } from "react";

/**
 * A captioned walkthrough video that only attaches its MP4 once it is near
 * the viewport, so /tour loads three posters, not three videos. Muted and
 * inline, with native controls and a WebVTT captions track (on by default).
 */
export function LazyVideo({
  src,
  poster,
  captions,
  label,
  width,
  height,
}: {
  src: string;
  poster: string;
  captions: string;
  label: string;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const attach = () => {
      if (!el.getAttribute("src")) el.src = src;
    };
    if (typeof IntersectionObserver === "undefined") {
      attach();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          attach();
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      poster={poster}
      width={width}
      height={height}
      controls
      muted
      playsInline
      preload="metadata"
      aria-label={label}
      className="border-border bg-muted/40 block h-auto w-full rounded-lg border shadow-[0_20px_50px_-24px_rgb(0_0_0/0.35)]"
    >
      <track kind="captions" src={captions} srcLang="en" label="English" default />
      <p className="p-4 text-sm">
        Your browser cannot play this video.{" "}
        <a href={src} className="link">
          Download the MP4
        </a>
        .
      </p>
    </video>
  );
}
