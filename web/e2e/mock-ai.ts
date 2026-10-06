/**
 * A mocked AI provider for the tour. No real key is ever used: the "key" is a
 * placeholder typed into the bring-your-own-key dialog, every request to a
 * provider is intercepted in the browser context, and the reply is written
 * here.
 *
 * Only the model's two replies are mocked. The SQL it "writes" is sent to
 * this site's real validator and runs on the real read-only database, and the
 * mocked explanation is built from the rows that query actually returned (the
 * app sends them in the prompt), so the site's own citation check passes on
 * real numbers. Every mocked text starts with MOCK_PREFIX, the served model id
 * ends in "-mock", and the mock reports zero tokens: it has no usage to report.
 */
import type { BrowserContext, Request } from "@playwright/test";

import { MOCK_PREFIX, TOUR_QUESTION } from "../src/lib/showcase";

/** Not a credential: an obviously fake placeholder typed into the BYOK dialog. */
export const PLACEHOLDER_KEY = "placeholder-not-a-real-key";

/** The SQL the mocked model returns for the tour question. */
export const MOCK_SQL =
  "SELECT r.name AS suburb, t.tweet_count AS crime_tweets, t.avg_score AS avg_sentiment " +
  "FROM twitter_sal_sentiment t JOIN regions_sal r ON r.sal_code = t.sal_code " +
  "WHERE t.topic = 'crime' AND t.state = 'Victoria' ORDER BY t.tweet_count DESC LIMIT 5";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

interface AnthropicRequest {
  model?: string;
  system?: { type: string; text: string }[] | string;
  messages?: { role: string; content: string }[];
}

const fmt = (n: unknown) => (typeof n === "number" ? n.toLocaleString("en-AU") : String(n));

/** The reply to the "write SQL" call. */
export function mockSql(question: string) {
  if (question.includes(TOUR_QUESTION)) {
    return {
      answerable: true,
      sql: MOCK_SQL,
      reason: `${MOCK_PREFIX} Joins suburb names to the crime-topic tweet counts for Victoria and keeps the five largest.`,
    };
  }
  return {
    answerable: false,
    sql: "",
    reason: `${MOCK_PREFIX} The mock only answers the tour's example question.`,
  };
}

/** The reply to the "explain the rows" call, built from the rows the app sent. */
export function mockExplanation(prompt: string) {
  const json = prompt.slice(prompt.lastIndexOf("\n\n") + 2);
  let rows: Record<string, unknown>[] = [];
  try {
    rows = JSON.parse(json) as Record<string, unknown>[];
  } catch {
    rows = [];
  }
  const [r1, r2, r3] = rows;
  if (!r1 || !r2 || !r3 || !("suburb" in r1)) {
    return {
      answer: `${MOCK_PREFIX} The mock only explains the tour's example question.`,
      cited_rows: [],
      caveat: "",
    };
  }
  return {
    answer:
      `${MOCK_PREFIX} ${r1.suburb} had by far the most crime-related tweets, ${fmt(r1.crime_tweets)}, ` +
      `averaging ${fmt(r1.avg_sentiment)} on the 1-9 scale [r1]. ` +
      `${r2.suburb} (${fmt(r2.crime_tweets)}) and ${r3.suburb} (${fmt(r3.crime_tweets)}) came next [r2] [r3].`,
    cited_rows: [1, 2, 3],
    caveat:
      "These count geotagged tweets from February to July 2022, so busy suburbs dominate; they say nothing about recorded crime.",
  };
}

export interface MockAi {
  /** Requests that reached the mock (each one an AI call the app made). */
  calls: number;
  /** Requests to anything else that carried the placeholder key (must stay empty). */
  leaks: string[];
}

export async function mockAiProviders(
  context: BrowserContext,
  { latencyMs = 1100 }: { latencyMs?: number } = {},
): Promise<MockAi> {
  const state: MockAi = { calls: 0, leaks: [] };

  await context.route("https://api.anthropic.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    state.calls += 1;
    const body = JSON.parse(req.postData() ?? "{}") as AnthropicRequest;
    const system = Array.isArray(body.system)
      ? body.system.map((b) => b.text).join("\n")
      : (body.system ?? "");
    const user = body.messages?.find((m) => m.role === "user")?.content ?? "";
    const reply = system.startsWith("You translate questions") ? mockSql(user) : mockExplanation(user);
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({
        id: `msg_mock_${state.calls}`,
        type: "message",
        role: "assistant",
        model: `${body.model ?? "unknown"}-mock`,
        content: [{ type: "text", text: JSON.stringify(reply) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    });
  });

  // The tour never uses OpenAI; block it so nothing can leave the browser.
  await context.route("https://api.openai.com/**", (route) => route.abort("blockedbyclient"));

  context.on("request", (req: Request) => {
    if (req.url().startsWith("https://api.anthropic.com/")) return;
    const headers = JSON.stringify(req.headers());
    const data = req.postData() ?? "";
    if (
      headers.includes(PLACEHOLDER_KEY) ||
      data.includes(PLACEHOLDER_KEY) ||
      req.url().includes(PLACEHOLDER_KEY)
    ) {
      state.leaks.push(req.url());
    }
  });

  return state;
}
