/**
 * Provider adapters. Both call the provider's HTTP API directly from the
 * visitor's browser with the visitor's own key; nothing goes through this
 * site's server. Raw `fetch` rather than an SDK keeps the client bundle small
 * and gives one adapter shape for both providers (and lets tests mock fetch).
 */
import { AiError, type ProviderReply, type ProviderRequest } from "./types";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function send(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AiError("aborted");
    if (e instanceof Error && e.name === "AbortError") throw new AiError("aborted");
    throw new AiError("network");
  }
}

async function errorDetail(res: Response): Promise<{ type?: string; code?: string; message?: string }> {
  try {
    const body = (await res.json()) as { error?: { type?: string; code?: string; message?: string } };
    return body.error ?? {};
  } catch {
    return {};
  }
}

function mapStatus(status: number, detail: { type?: string; code?: string; message?: string }): AiError {
  const msg = detail.message?.slice(0, 200);
  if (status === 401 || status === 403) return new AiError("invalid_key", { status, detail: msg });
  if (status === 404) return new AiError("model_not_found", { status, detail: msg });
  if (status === 429) {
    if (detail.code === "insufficient_quota" || /quota|credit/i.test(detail.message ?? ""))
      return new AiError("quota", { status, detail: msg });
    return new AiError("rate_limited", { status, detail: msg });
  }
  if (status === 529 || status === 503) return new AiError("overloaded", { status, detail: msg });
  if (status >= 500) return new AiError("server", { status, detail: msg });
  if (/model/i.test(detail.message ?? "") && /not|invalid|exist/i.test(detail.message ?? ""))
    return new AiError("model_not_found", { status, detail: msg });
  if (/credit balance/i.test(detail.message ?? "")) return new AiError("quota", { status, detail: msg });
  return new AiError("bad_request", { status, detail: msg });
}

interface AnthropicMessage {
  model: string;
  content: { type: string; text?: string }[];
  stop_reason: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Anthropic Messages API with structured outputs (`output_config.format`).
 * The `anthropic-dangerous-direct-browser-access` header is Anthropic's
 * explicit opt-in for browser calls; it is appropriate here because the key
 * belongs to the person using the browser.
 */
export async function callAnthropic(req: ProviderRequest): Promise<ProviderReply> {
  const fetchImpl = req.fetchImpl ?? fetch;
  // Sonnet-class models think adaptively by default; medium effort keeps cost in check.
  // Haiku 4.5 does not take an effort setting.
  const effort = req.model.startsWith("claude-haiku") ? {} : { effort: "medium" };
  const res = await send(fetchImpl, ANTHROPIC_URL, {
    method: "POST",
    signal: req.signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: req.user }],
      output_config: { format: { type: "json_schema", schema: req.schema }, ...effort },
    }),
  });
  if (!res.ok) throw mapStatus(res.status, await errorDetail(res));
  const msg = (await res.json()) as AnthropicMessage;
  if (msg.stop_reason === "refusal") throw new AiError("refusal");
  if (msg.stop_reason === "max_tokens") throw new AiError("truncated");
  const text = msg.content.find((b) => b.type === "text")?.text;
  if (!text) throw new AiError("invalid_output", { detail: "no text in the reply" });
  return {
    text,
    model: msg.model,
    usage: msg.usage
      ? { inputTokens: msg.usage.input_tokens ?? 0, outputTokens: msg.usage.output_tokens ?? 0 }
      : null,
  };
}

interface OpenAiCompletion {
  model: string;
  choices: { finish_reason: string; message: { content: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenAI Chat Completions with a strict JSON-schema response format. */
export async function callOpenAi(req: ProviderRequest): Promise<ProviderReply> {
  const fetchImpl = req.fetchImpl ?? fetch;
  const res = await send(fetchImpl, OPENAI_URL, {
    method: "POST",
    signal: req.signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: req.schemaName, strict: true, schema: req.schema },
      },
      max_completion_tokens: req.maxTokens,
    }),
  });
  if (!res.ok) throw mapStatus(res.status, await errorDetail(res));
  const body = (await res.json()) as OpenAiCompletion;
  const choice = body.choices?.[0];
  if (!choice) throw new AiError("invalid_output", { detail: "no choices in the reply" });
  if (choice.message.refusal) throw new AiError("refusal", { detail: choice.message.refusal.slice(0, 200) });
  if (choice.finish_reason === "length") throw new AiError("truncated");
  if (!choice.message.content) throw new AiError("invalid_output", { detail: "empty reply" });
  return {
    text: choice.message.content,
    model: body.model,
    usage: body.usage
      ? { inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0 }
      : null,
  };
}
