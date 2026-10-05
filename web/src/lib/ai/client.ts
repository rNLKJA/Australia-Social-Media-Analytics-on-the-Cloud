import type { z } from "zod";
import { callAnthropic, callOpenAi } from "./providers";
import { AiError, type AiSettings, modelFor, type Provider, type TokenUsage } from "./types";

export interface StructuredCall<T extends z.ZodType> {
  settings: AiSettings;
  apiKey: string | null;
  system: string;
  user: string;
  schemaName: string;
  /** JSON Schema sent to the provider */
  jsonSchema: Record<string, unknown>;
  /** the same contract, enforced again on our side */
  zodSchema: T;
  maxTokens?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface StructuredResult<T> {
  data: T;
  provider: Provider;
  /** the model id requested */
  model: string;
  /** the model id the provider reports */
  servedModel: string;
  usage: TokenUsage | null;
  latencyMs: number;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * One structured-output call to the visitor's chosen provider. The provider
 * is asked to follow a JSON Schema; the reply is then parsed and validated
 * with zod here too, because a schema-following model can still fail
 * (refusals, truncation, a provider bug) and unvalidated output never reaches
 * the UI.
 */
export async function callStructured<T extends z.ZodType>(
  call: StructuredCall<T>,
): Promise<StructuredResult<z.infer<T>>> {
  if (!call.apiKey) throw new AiError("no_key");
  const provider = call.settings.provider;
  const model = modelFor(call.settings).trim();
  if (!model) throw new AiError("model_not_found", { detail: "no model id set" });
  const started = now();
  const req = {
    apiKey: call.apiKey,
    model,
    system: call.system,
    user: call.user,
    schemaName: call.schemaName,
    schema: call.jsonSchema,
    maxTokens: call.maxTokens ?? 8000,
    signal: call.signal,
    fetchImpl: call.fetchImpl,
  };
  const reply = provider === "anthropic" ? await callAnthropic(req) : await callOpenAi(req);
  const latencyMs = Math.round(now() - started);
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.text);
  } catch {
    throw new AiError("invalid_output", { detail: "reply was not JSON" });
  }
  const result = call.zodSchema.safeParse(parsed);
  if (!result.success)
    throw new AiError("invalid_output", { detail: result.error.issues[0]?.message?.slice(0, 120) });
  return { data: result.data, provider, model, servedModel: reply.model, usage: reply.usage, latencyMs };
}

export function addUsage(a: TokenUsage | null, b: TokenUsage | null): TokenUsage | null {
  if (!a) return b;
  if (!b) return a;
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}
