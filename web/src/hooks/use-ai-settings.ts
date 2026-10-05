"use client";

import { useSyncExternalStore } from "react";
import { type AiState, getState, SERVER_STATE, subscribe } from "@/lib/ai/settings";

/** The visitor's AI settings and whether a key is stored (no key value is exposed). */
export function useAiSettings(): AiState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
}
