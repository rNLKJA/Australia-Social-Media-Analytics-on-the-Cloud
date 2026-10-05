import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listDecisions, parseDecision } from "@/server/content";

const web = path.resolve(import.meta.dirname, "..", "..");
const docs = path.resolve(web, "..", "docs");
const content = path.join(web, "content");

describe("decision records and model card", () => {
  it.runIf(existsSync(docs))("web/content mirrors docs/ exactly (run node tools/sync-docs.mjs)", () => {
    const names = readdirSync(path.join(docs, "decisions")).filter((f) => f.endsWith(".md"));
    expect(readdirSync(path.join(content, "decisions")).sort()).toEqual(names.sort());
    for (const f of names)
      expect(readFileSync(path.join(content, "decisions", f), "utf8")).toBe(
        readFileSync(path.join(docs, "decisions", f), "utf8"),
      );
    expect(readFileSync(path.join(content, "model-card.md"), "utf8")).toBe(
      readFileSync(path.join(docs, "model-card.md"), "utf8"),
    );
  });

  it("every record follows the format, in order, and is numbered from its file name", async () => {
    const records = await listDecisions();
    expect(records.length).toBeGreaterThanOrEqual(4);
    const order = [
      "## Context",
      "## Decision",
      "## Options considered",
      "## Why",
      "## What happened",
      "## What I'd change",
    ];
    for (const r of records) {
      expect(r.slug.startsWith(r.id)).toBe(true);
      expect(r.status).not.toBe("");
      const at = order.map((h) => r.body.indexOf(`\n${h}\n`));
      expect(at.every((i) => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      // house style: no em dashes, and no claims of formal compliance
      expect(r.body).not.toContain("—");
      expect(r.body).not.toMatch(/\b(is|are|fully) compliant\b/i);
    }
  });

  it("rejects a record without a proper title", () => {
    expect(() => parseDecision("DR-009-x", "# Something\n")).toThrow();
  });
});
