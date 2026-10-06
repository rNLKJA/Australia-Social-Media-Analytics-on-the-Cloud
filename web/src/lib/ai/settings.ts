/**
 * Where the visitor's AI settings and key live: only in their browser.
 *
 * - Settings (provider, model ids, the "remember" choice) are not secret and
 *   live in localStorage.
 * - The key lives in sessionStorage by default (gone when the tab closes); in
 *   localStorage only if the visitor ticks "remember on this device".
 * - "Forget key" removes it from both.
 *
 * Nothing here is ever sent to this site's server, and the key is never
 * written to the audit log (see audit-log.ts, which also redacts defensively).
 */
import { type AiSettings, DEFAULT_SETTINGS, type Provider } from "./types";

const SETTINGS_KEY = "social-sense.ai.settings";
const KEY_PREFIX = "social-sense.ai.key.";
const PROVIDERS: Provider[] = ["anthropic", "openai"];

function stores(): { session: Storage | null; local: Storage | null } {
  const g = globalThis as { sessionStorage?: Storage; localStorage?: Storage };
  try {
    return { session: g.sessionStorage ?? null, local: g.localStorage ?? null };
  } catch {
    // storage can throw when blocked by privacy settings
    return { session: null, local: null };
  }
}

const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  cached = null;
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith("social-sense.ai.")) emit();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function loadSettings(): AiSettings {
  const { local } = stores();
  try {
    const raw = local?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw) as Partial<AiSettings>;
    return {
      provider: v.provider === "openai" ? "openai" : "anthropic",
      anthropicModel:
        typeof v.anthropicModel === "string" ? v.anthropicModel : DEFAULT_SETTINGS.anthropicModel,
      openaiModel:
        typeof v.openaiModel === "string" && v.openaiModel.trim()
          ? v.openaiModel
          : DEFAULT_SETTINGS.openaiModel,
      remember: v.remember === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AiSettings): void {
  const { local } = stores();
  try {
    local?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: settings fall back to defaults next time */
  }
  emit();
}

export function getKey(provider: Provider): string | null {
  const { session, local } = stores();
  try {
    return session?.getItem(KEY_PREFIX + provider) || local?.getItem(KEY_PREFIX + provider) || null;
  } catch {
    return null;
  }
}

/** Store a key for this tab, and on this device too when `remember` is set. */
export function setKey(provider: Provider, key: string, remember: boolean): void {
  const { session, local } = stores();
  const k = key.trim();
  try {
    if (!k) {
      session?.removeItem(KEY_PREFIX + provider);
      local?.removeItem(KEY_PREFIX + provider);
    } else {
      session?.setItem(KEY_PREFIX + provider, k);
      if (remember) local?.setItem(KEY_PREFIX + provider, k);
      else local?.removeItem(KEY_PREFIX + provider);
    }
  } catch {
    /* blocked storage: the key simply is not kept */
  }
  emit();
}

/** Remove every stored key (both providers, both storages). */
export function forgetKeys(): void {
  const { session, local } = stores();
  for (const p of PROVIDERS) {
    try {
      session?.removeItem(KEY_PREFIX + p);
      local?.removeItem(KEY_PREFIX + p);
    } catch {
      /* ignore */
    }
  }
  emit();
}

/** Mask a key for display: provider prefix and the last four characters. */
export function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export interface AiState {
  settings: AiSettings;
  hasKey: boolean;
  version: number;
}

let cached: AiState | null = null;

/** Snapshot for useSyncExternalStore (stable between changes). */
export function getState(): AiState {
  if (!cached) {
    const settings = loadSettings();
    cached = { settings, hasKey: !!getKey(settings.provider), version };
  }
  return cached;
}

export const SERVER_STATE: AiState = { settings: DEFAULT_SETTINGS, hasKey: false, version: -1 };
