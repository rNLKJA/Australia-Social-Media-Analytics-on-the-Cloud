/** Shared types for the bring-your-own-key AI features. */

export type Provider = "anthropic" | "openai";

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
};

/** Claude models offered in the settings (current IDs from Anthropic's model list). */
export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "default; fastest and cheapest" },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    note: "stronger; costs about twice as much per token",
  },
] as const;

export const DEFAULT_ANTHROPIC_MODEL = ANTHROPIC_MODELS[0].id;

/** OpenAI's model list changes often, so the id is free text with a small default. */
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export interface AiSettings {
  provider: Provider;
  anthropicModel: string;
  openaiModel: string;
  /** keep the key in localStorage (this device) instead of sessionStorage (this tab) */
  remember: boolean;
}

export const DEFAULT_SETTINGS: AiSettings = {
  provider: "anthropic",
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  openaiModel: DEFAULT_OPENAI_MODEL,
  remember: false,
};

export function modelFor(s: AiSettings): string {
  return s.provider === "anthropic" ? s.anthropicModel : s.openaiModel;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AiErrorKind =
  | "no_key"
  | "invalid_key"
  | "rate_limited"
  | "quota"
  | "overloaded"
  | "model_not_found"
  | "bad_request"
  | "network"
  | "refusal"
  | "truncated"
  | "invalid_output"
  | "aborted"
  | "server";

const HINT: Record<AiErrorKind, string> = {
  no_key: "Add your own API key in AI settings to use this feature.",
  invalid_key:
    "The provider rejected the key. Check it in AI settings (and that it belongs to the selected provider).",
  rate_limited: "The provider is rate-limiting this key. Wait a moment and try again.",
  quota: "The key has no remaining credit or quota with the provider.",
  overloaded: "The provider is overloaded right now. Try again shortly.",
  model_not_found:
    "The provider does not recognise this model id for your key. Pick another model in AI settings.",
  bad_request: "The provider refused the request.",
  network:
    "Could not reach the provider from your browser. Check your connection; a privacy extension or network policy may be blocking the call.",
  refusal: "The model declined to answer this request.",
  truncated: "The model's reply was cut off before it finished.",
  invalid_output: "The model's reply did not match the expected structure, so it was discarded.",
  aborted: "Cancelled.",
  server: "The provider returned a server error. Try again shortly.",
};

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly detail?: string;
  constructor(kind: AiErrorKind, opts: { status?: number; detail?: string } = {}) {
    super(opts.detail ? `${HINT[kind]} (${opts.detail})` : HINT[kind]);
    this.name = "AiError";
    this.kind = kind;
    this.status = opts.status;
    this.detail = opts.detail;
  }
}

/** The raw result of one provider call, before validation. */
export interface ProviderReply {
  text: string;
  usage: TokenUsage | null;
  /** the model id the provider reports it served */
  model: string;
}

export interface ProviderRequest {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  /** JSON Schema of the reply (structured outputs) */
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}
