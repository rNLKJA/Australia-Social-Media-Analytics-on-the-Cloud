"use client";

import { useEffect, useRef, useState } from "react";

/** Track an element's content-box size with ResizeObserver. */
export function useElementSize<T extends HTMLElement>(initial = { width: 640, height: 400 }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
