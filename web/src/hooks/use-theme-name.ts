"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { ThemeName } from "@/lib/palette";

const subscribe = () => () => {};

/** Resolved theme ("light" until mounted, to keep SSR and hydration identical). */
export function useThemeName(): ThemeName {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted && resolvedTheme === "dark" ? "dark" : "light";
}
