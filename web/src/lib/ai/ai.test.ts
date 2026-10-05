import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BENCHMARK } from "@/lib/sql/benchmark";
import type { SqlRunResponse } from "@/lib/sql/client";
import { finishFlow, rerunFlow, startFlow, toEntry } from "./ask-record";
import {
  appendEntry,
  type AuditEntry,
  clearEntries,
  decisionPatch,
  entriesToCsv,
  listEntries,
  redactSecrets,
  updateEntry,
} from "./audit-log";
import { callStructured } from "./client";
import { compareRuns, type EvalRun, scoreItem, summariseRun } from "./eval";
import { ANTHROPIC_URL, OPENAI_URL } from "./providers";
import { forgetKeys, getKey, getState, loadSettings, saveSettings, setKey } from "./settings";
import { checkCitations, explainPrompt, generateSql, SQL_SYSTEM_PROMPT, sqlReplySchema } from "./text-to-sql";
import { AiError, type AiSettings, DEFAULT_SETTINGS } from "./types";

const KEY = "sk-ant-api03-TESTKEY-not-a-real-key-0123456789";
const anthropic: AiSettings = { ...DEFAULT_SETTINGS };
const openai: AiSettings = { ...DEFAULT_SETTINGS, provider: "openai", openaiModel: "gpt-test" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const anthropicReply = (text: string, extra: Record<string, unknown> = {}) =>
  jsonResponse({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 1200, output_tokens: 80 },
    ...extra,
  });

const openaiReply = (content: string, extra: Record<string, unknown> = {}) =>
  jsonResponse({
    id: "chatcmpl-1",
    model: "gpt-test-2026",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content, refusal: null } }],
    usage: { prompt_tokens: 900, completion_tokens: 40 },
    ...extra,
  });

const goodSql = JSON.stringify({
  answerable: true,
  sql: "SELECT COUNT(*) FROM crime_lga",
  reason: "Counts LGAs.",
});

describe("Anthropic adapter (fetch mocked)", () => {
  it("calls the Messages API from the browser with the visitor's key and structured outputs", async () => {
    const fetchImpl = vi.fn(async () => anthropicReply(goodSql));
    const res = await generateSql("How many LGAs?", anthropic, KEY, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ANTHROPIC_URL);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(KEY);
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.effort).toBeUndefined(); // Haiku takes no effort setting
    expect(body.system[0].text).toBe(SQL_SYSTEM_PROMPT);
    expect(body.messages).toEqual([{ role: "user", content: "Question: How many LGAs?" }]);
    expect(JSON.stringify(body)).not.toContain(KEY); // the key travels only in the header
    expect(res.data.sql).toBe("SELECT COUNT(*) FROM crime_lga");
    expect(res.usage).toEqual({ inputTokens: 1200, outputTokens: 80 });
    expect(res.servedModel).toBe("claude-haiku-4-5");
  });

  it("asks Sonnet for medium effort", async () => {
    const fetchImpl = vi.fn(async () => anthropicReply(goodSql));
    await generateSql("q", { ...anthropic, anthropicModel: "claude-sonnet-5-5" }, KEY, { fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.output_config.effort).toBe("medium");
  });

  it.each([
    [401, { error: { type: "authentication_error", message: "invalid x-api-key" } }, "invalid_key"],
    [429, { error: { type: "rate_limit_error", message: "slow down" } }, "rate_limited"],
    [529, { error: { type: "overloaded_error", message: "Overloaded" } }, "overloaded"],
    [404, { error: { type: "not_found_error", message: "model: nope" } }, "model_not_found"],
    [400, { error: { type: "invalid_request_error", message: "Your credit balance is too low" } }, "quota"],
    [500, { error: { type: "api_error", message: "boom" } }, "server"],
  ])("maps HTTP %i to a readable error", async (status, body, kind) => {
    const fetchImpl = vi.fn(async () => jsonResponse(body, status));
    await expect(generateSql("q", anthropic, KEY, { fetchImpl })).rejects.toMatchObject({ kind });
  });

  it("reports network/CORS failures, refusals, truncation and malformed output", async () => {
    const boom = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(generateSql("q", anthropic, KEY, { fetchImpl: boom })).rejects.toMatchObject({
      kind: "network",
    });
    const refusal = vi.fn(async () => anthropicReply("", { stop_reason: "refusal" }));
    await expect(generateSql("q", anthropic, KEY, { fetchImpl: refusal })).rejects.toMatchObject({
      kind: "refusal",
    });
    const cut = vi.fn(async () => anthropicReply('{"answerable": tr', { stop_reason: "max_tokens" }));
    await expect(generateSql("q", anthropic, KEY, { fetchImpl: cut })).rejects.toMatchObject({
      kind: "truncated",
    });
    const notJson = vi.fn(async () => anthropicReply("SELECT 1"));
    await expect(generateSql("q", anthropic, KEY, { fetchImpl: notJson })).rejects.toMatchObject({
      kind: "invalid_output",
    });
    const wrongShape = vi.fn(async () => anthropicReply(JSON.stringify({ answerable: "yes", sql: 1 })));
    await expect(generateSql("q", anthropic, KEY, { fetchImpl: wrongShape })).rejects.toMatchObject({
      kind: "invalid_output",
    });
  });

  it("keeps the billed tokens and time of a failed call", async () => {
    const notJson = vi.fn(async () => anthropicReply("SELECT 1"));
    const err = await generateSql("q", anthropic, KEY, { fetchImpl: notJson }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err).toMatchObject({ kind: "invalid_output", usage: { inputTokens: 1200, outputTokens: 80 } });
    expect((err as AiError).latencyMs).toBeGreaterThanOrEqual(0);
    const cut = vi.fn(async () => anthropicReply("{", { stop_reason: "max_tokens" }));
    await expect(generateSql("q", anthropic, KEY, { fetchImpl: cut })).rejects.toMatchObject({
      kind: "truncated",
      usage: { inputTokens: 1200, outputTokens: 80 },
    });
  });

  it("treats a 200 response that is not JSON as a network problem, not a crash", async () => {
    const portal = vi.fn(
      async () =>
        new Response("<html>oops</html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const err = await generateSql("q", anthropic, KEY, { fetchImpl: portal }).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "network" });
    expect((err as Error).message).not.toContain("Unexpected token");
    await expect(generateSql("q", openai, KEY, { fetchImpl: portal })).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("refuses to call anything without a key", async () => {
    const fetchImpl = vi.fn();
    await expect(generateSql("q", anthropic, null, { fetchImpl })).rejects.toBeInstanceOf(AiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("OpenAI adapter (fetch mocked)", () => {
  it("uses Chat Completions with a strict JSON schema and a bearer key", async () => {
    const fetchImpl = vi.fn(async () => openaiReply(goodSql));
    const res = await generateSql("How many LGAs?", openai, "sk-proj-TESTKEY1234567890abcdef", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENAI_URL);
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer sk-proj-TESTKEY1234567890abcdef",
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-test");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.max_completion_tokens).toBeGreaterThan(0);
    expect(body.temperature).toBeUndefined();
    expect(res.usage).toEqual({ inputTokens: 900, outputTokens: 40 });
  });
  it("maps refusals, quota and truncation", async () => {
    const refusal = vi.fn(async () =>
      jsonResponse({
        model: "m",
        choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }],
      }),
    );
    await expect(generateSql("q", openai, "sk-x", { fetchImpl: refusal })).rejects.toMatchObject({
      kind: "refusal",
    });
    const quota = vi.fn(async () =>
      jsonResponse(
        { error: { code: "insufficient_quota", message: "You exceeded your current quota" } },
        429,
      ),
    );
    await expect(generateSql("q", openai, "sk-x", { fetchImpl: quota })).rejects.toMatchObject({
      kind: "quota",
    });
    const cut = vi.fn(async () =>
      jsonResponse({ model: "m", choices: [{ finish_reason: "length", message: { content: "{" } }] }),
    );
    await expect(generateSql("q", openai, "sk-x", { fetchImpl: cut })).rejects.toMatchObject({
      kind: "truncated",
    });
  });
});

describe("structured output contract", () => {
  it("validates with zod after the provider", async () => {
    expect(sqlReplySchema.safeParse({ answerable: false, sql: "", reason: "no user data" }).success).toBe(
      true,
    );
    expect(sqlReplySchema.safeParse({ answerable: false, sql: "" }).success).toBe(false);
    const fetchImpl = vi.fn(async () => anthropicReply(JSON.stringify({ answer: "x" })));
    await expect(
      callStructured({
        settings: anthropic,
        apiKey: KEY,
        system: "s",
        user: "u",
        schemaName: "x",
        jsonSchema: {},
        zodSchema: sqlReplySchema,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("checks that answers cite rows that were actually returned", () => {
    expect(
      checkCitations({ answer: "Melbourne had the most [r1].", cited_rows: [1], caveat: "" }, 3),
    ).toEqual({
      cited: [1],
      invalid: [],
      grounded: true,
    });
    const bad = checkCitations({ answer: "It was 5 [r9].", cited_rows: [9], caveat: "" }, 3);
    expect(bad.grounded).toBe(false);
    expect(bad.invalid).toEqual([9]);
    expect(checkCitations({ answer: "No citation here.", cited_rows: [], caveat: "" }, 3).grounded).toBe(
      false,
    );
  });

  it("numbers the rows it sends and caps them", () => {
    const rows = Array.from({ length: 40 }, (_, i) => [`n${i}`, i]);
    const prompt = explainPrompt("q", "SELECT 1", ["name", "v"], rows);
    expect(prompt).toContain('"row":"r1"');
    expect(prompt).toContain("first 30 shown");
    expect(prompt).not.toContain('"row":"r31"');
  });
});

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  dump() {
    return JSON.stringify([...this.m.entries()]);
  }
}

describe("key and settings storage", () => {
  let session: MemoryStorage;
  let local: MemoryStorage;
  beforeEach(() => {
    session = new MemoryStorage();
    local = new MemoryStorage();
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("localStorage", local);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the key in sessionStorage by default", () => {
    setKey("anthropic", KEY, false);
    expect(session.getItem("social-sense.ai.key.anthropic")).toBe(KEY);
    expect(local.dump()).not.toContain(KEY);
    expect(getKey("anthropic")).toBe(KEY);
  });
  it("keeps it on the device only when asked, and forgets it everywhere", () => {
    setKey("openai", "sk-proj-abcdefghijklmnop", true);
    expect(local.getItem("social-sense.ai.key.openai")).toBe("sk-proj-abcdefghijklmnop");
    setKey("openai", "sk-proj-abcdefghijklmnop", false);
    expect(local.getItem("social-sense.ai.key.openai")).toBeNull();
    setKey("anthropic", KEY, true);
    forgetKeys();
    expect(getKey("anthropic")).toBeNull();
    expect(session.dump() + local.dump()).not.toContain(KEY);
  });
  it("never writes the key into the settings record", () => {
    setKey("anthropic", KEY, true);
    saveSettings({ ...DEFAULT_SETTINGS, remember: true });
    expect(local.getItem("social-sense.ai.settings")).not.toContain(KEY);
    expect(loadSettings().remember).toBe(true);
    expect(getState().hasKey).toBe(true);
  });
  it("falls back to defaults on corrupt settings", () => {
    local.setItem("social-sense.ai.settings", "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "e1",
  timestamp: "2026-10-06T00:00:00.000Z",
  feature: "ask-the-data",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  input: { question: "How many LGAs?" },
  output: { answerable: true, generatedSql: "SELECT COUNT(*) FROM crime_lga" },
  validation: { verdict: "allowed", issues: [] },
  rowCount: 1,
  latencyMs: { model: 900, sql: 12, total: 950 },
  usage: { inputTokens: 1200, outputTokens: 80 },
  decision: "pending",
  ...over,
});

describe("audit log (IndexedDB)", () => {
  beforeEach(async () => {
    await clearEntries();
  });

  it("appends, updates the human decision and lists newest first", async () => {
    await appendEntry(entry());
    await appendEntry(entry({ id: "e2", timestamp: "2026-10-06T01:00:00.000Z" }));
    await updateEntry("e1", { decision: "accepted" });
    const all = await listEntries();
    expect(all.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(all[1].decision).toBe("accepted");
  });

  it("never stores the key, even if it leaks into a question", async () => {
    await appendEntry(entry({ input: { question: `my key is ${KEY} how many LGAs?` } }), [KEY]);
    await appendEntry(entry({ id: "e3", input: { question: "sk-proj-AAAAAAAAAAAAAAAAAAAAAAAA" } }));
    const all = await listEntries();
    const dump = JSON.stringify(all);
    expect(dump).not.toContain(KEY);
    expect(dump).not.toContain("sk-proj-AAAA");
    expect(dump).toContain("[redacted]");
  });

  it("exports CSV with one row per record", async () => {
    await appendEntry(entry());
    const csv = entriesToCsv(await listEntries());
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("validation_verdict");
    expect(lines[1]).toContain("SELECT COUNT(*) FROM crime_lga");
  });

  it("changes only the decision when a person accepts or rejects", async () => {
    const asked = new Date("2026-10-06T02:00:00.000Z");
    let f = startFlow("How many LGAs?", "anthropic", "claude-haiku-4-5", { now: 1000, date: asked });
    f = { ...f, reply: { answerable: true, sql: "SELECT 1", reason: "r" }, modelMs: 90, usage: null };
    f = finishFlow(f, 1120);
    await appendEntry(toEntry(f));
    // eight seconds later the person clicks Accept
    await updateEntry(f.id, decisionPatch("accepted", new Date("2026-10-06T02:00:08.000Z")));
    const [stored] = await listEntries();
    expect(stored.timestamp).toBe(asked.toISOString());
    expect(stored.latencyMs).toEqual({ model: 90, total: 120 });
    expect(stored.decision).toBe("accepted");
    expect(stored.decidedAt).toBe("2026-10-06T02:00:08.000Z");
    expect(stored.output.generatedSql).toBe("SELECT 1");
    // finishing twice never moves the end-to-end time
    expect(finishFlow(f, 99999).totalMs).toBe(120);
  });

  it("logs a re-run of edited SQL as a new record and keeps the model's original output", async () => {
    let f = startFlow("q", "anthropic", "claude-haiku-4-5", { now: 0, date: new Date() });
    f = finishFlow({ ...f, reply: { answerable: true, sql: "SELECT 1", reason: "r" }, modelMs: 50 }, 60);
    await appendEntry(toEntry(f));
    await updateEntry(f.id, decisionPatch("edited"));
    let child = rerunFlow(f, "SELECT 2", { now: 100, date: new Date() });
    child = finishFlow(child, 140);
    await appendEntry(toEntry(child));
    const all = await listEntries();
    expect(all).toHaveLength(2);
    const parent = all.find((e) => e.id === f.id)!;
    const rerun = all.find((e) => e.id === child.id)!;
    expect(parent.output.generatedSql).toBe("SELECT 1");
    expect(parent.output.editedSql).toBeUndefined();
    expect(parent.decision).toBe("edited");
    expect(rerun.parentId).toBe(f.id);
    expect(rerun.output.editedSql).toBe("SELECT 2");
    expect(rerun.output.generatedSql).toBeUndefined();
    expect(rerun.latencyMs.total).toBe(40);
    expect(rerun.latencyMs.model).toBeUndefined(); // no SQL-writing call in a re-run
    expect(rerun.decision).toBe("pending");
    // a second edit still points at the original question's record
    expect(rerunFlow(child, "SELECT 3", { now: 0, date: new Date() }).parentId).toBe(f.id);
  });

  it("redacts quoted and escaped occurrences", () => {
    const k = 'abc"defghijk';
    expect(JSON.stringify(redactSecrets({ q: `x ${k} y` }, [k]))).not.toContain("defghijk");
  });
});

describe("benchmark scoring", () => {
  const ans = BENCHMARK.find((b) => b.id === "q03")!;
  const unans = BENCHMARK.find((b) => b.id === "q15")!;
  const gold = { columns: ["lgas"], rows: [[72]] };
  const run = (over: Partial<SqlRunResponse>): SqlRunResponse => ({
    verdict: "allowed",
    issues: [],
    sql: "",
    executedSql: null,
    limitApplied: false,
    tables: [],
    columns: ["n"],
    rows: [[72]],
    rowCount: 1,
    truncated: false,
    elapsedMs: 1,
    error: null,
    ...over,
  });
  it("scores answerable questions by execution match", () => {
    expect(scoreItem(ans, { answerable: true, sql: "x" }, run({}), gold).status).toBe("correct");
    expect(scoreItem(ans, { answerable: true, sql: "x" }, run({ rows: [[79]] }), gold).status).toBe("wrong");
    expect(
      scoreItem(
        ans,
        { answerable: true, sql: "x" },
        run({ verdict: "blocked", issues: [{ code: "c", message: "m" }] }),
        gold,
      ).status,
    ).toBe("blocked");
    expect(scoreItem(ans, { answerable: false, sql: "" }, null, gold).status).toBe("refused");
    expect(scoreItem(ans, null, null, gold, "rate limited").status).toBe("ai_error");
  });
  it("scores the model's own failures against it, and leaves only infrastructure failures out", () => {
    expect(scoreItem(ans, null, null, gold, "invalid_output").status).toBe("invalid_output");
    expect(scoreItem(ans, null, null, gold, "truncated").status).toBe("invalid_output");
    expect(scoreItem(ans, null, null, gold, "refusal").status).toBe("refused");
    expect(scoreItem(unans, null, null, null, "refusal").status).toBe("correct_refusal");
    expect(scoreItem(unans, null, null, null, "invalid_output").status).toBe("invalid_output");
    for (const kind of ["rate_limited", "network", "invalid_key", "quota", "overloaded", "server"])
      expect(scoreItem(ans, null, null, gold, kind).status).toBe("ai_error");
  });
  it("scores unanswerable questions by refusal", () => {
    expect(scoreItem(unans, { answerable: false, sql: "" }, null, null).status).toBe("correct_refusal");
    expect(scoreItem(unans, { answerable: true, sql: "SELECT 1" }, null, null).status).toBe("missed_refusal");
  });
  it("summarises with Wilson intervals and compares paired runs", () => {
    const ids = new Set(BENCHMARK.filter((b) => b.goldSql).map((b) => b.id));
    const mk = (correct: string[]): EvalRun => ({
      id: "r",
      timestamp: "t",
      provider: "anthropic",
      model: "m",
      repetition: 1,
      batchId: "b",
      results: BENCHMARK.map((b) => ({
        id: b.id,
        question: b.question,
        status: b.goldSql ? (correct.includes(b.id) ? "correct" : "wrong") : "correct_refusal",
        detail: "",
        sql: "",
        verdict: "allowed",
        latencyMs: 1000,
        usage: { inputTokens: 100, outputTokens: 10 },
      })),
    });
    const a = mk(["q01", "q02", "q03", "q04", "q05", "q06", "q07", "q08", "q09", "q10"]);
    const b = mk(["q01", "q02", "q03"]);
    const s = summariseRun(a.results, ids);
    expect(s.accuracy.k).toBe(10);
    expect(s.accuracy.n).toBe(14);
    expect(s.accuracy.lower).toBeLessThan(10 / 14);
    expect(s.refusal.k).toBe(2);
    expect(s.tokens!.perQuestion).toBe(110);
    const cmp = compareRuns(a, b, ids);
    expect(cmp).toMatchObject({ pairs: 14, bothCorrect: 3, onlyA: 7, onlyB: 0, neither: 4 });
    expect(cmp.mcnemar.p).toBeCloseTo(2 / 128, 12);
    // Tango interval, R PropCIs::scoreci.mp(0, 7, 14): [0.177034, 0.732008]
    expect(cmp.differenceCi.lower).toBeCloseTo(0.177034, 5);
    expect(cmp.differenceCi.upper).toBeCloseTo(0.732008, 5);
  });
  it("does not inflate accuracy when most replies are unusable", () => {
    const ids = new Set(BENCHMARK.filter((b) => b.goldSql).map((b) => b.id));
    const results = BENCHMARK.map((b) => ({
      id: b.id,
      question: b.question,
      ...(b.id === "q03"
        ? { status: "correct" as const, usage: { inputTokens: 1000, outputTokens: 40 } }
        : b.goldSql
          ? { status: "invalid_output" as const, usage: { inputTokens: 1000, outputTokens: 40 } }
          : { status: "correct_refusal" as const, usage: { inputTokens: 1000, outputTokens: 40 } }),
      detail: "",
      sql: "",
      verdict: "",
      latencyMs: 900,
    }));
    const s = summariseRun(results, ids);
    expect(s.accuracy.k).toBe(1);
    expect(s.accuracy.n).toBe(14); // not 1/1 = 100%
    expect(s.accuracy.upper).toBeLessThan(0.35);
    expect(s.invalidSql.k).toBe(13);
    expect(s.modelFailures).toBe(13);
    expect(s.aiErrors).toBe(0);
    expect(s.tokens!.input).toBe(16 * 1000); // failed calls' tokens are counted
    // an infrastructure failure, by contrast, drops out of the denominator
    const withOutage = results.map((r) =>
      r.id === "q01" ? { ...r, status: "ai_error" as const, usage: undefined } : r,
    );
    const s2 = summariseRun(
      withOutage.map((r) => ({ ...r, usage: r.usage ?? null })),
      ids,
    );
    expect(s2.accuracy.n).toBe(13);
    expect(s2.aiErrors).toBe(1);
    // and in a paired comparison an unusable reply is a wrong answer, not a dropped pair
    const run = (rs: typeof results): EvalRun => ({
      id: "r",
      timestamp: "t",
      provider: "anthropic",
      model: "m",
      repetition: 1,
      batchId: "b",
      results: rs,
    });
    const good = run(results.map((r) => (ids.has(r.id) ? { ...r, status: "correct" as const } : r)));
    const cmp = compareRuns(good, run(results), ids);
    expect(cmp.pairs).toBe(14);
    expect(cmp.onlyA).toBe(13);
  });
});
