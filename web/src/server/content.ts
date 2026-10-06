import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

/**
 * Decision records and the model card, read from web/content/ (a mirror of
 * the repository's docs/, see tools/sync-docs.mjs) at build time.
 */
const CONTENT = path.join(process.cwd(), "content");

export interface DecisionRecord {
  slug: string;
  /** e.g. "DR-003" */
  id: string;
  title: string;
  status: string;
  decided: string;
  scope: string;
  /** markdown after the title line */
  body: string;
}

function field(md: string, name: string): string {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\* (.+)$`, "m").exec(md);
  return m ? m[1].trim() : "";
}

export function parseDecision(slug: string, md: string): DecisionRecord {
  const first = md.split("\n", 1)[0];
  const m = /^# (DR-\d{3}): (.+)$/.exec(first);
  if (!m) throw new Error(`${slug}: the first line must be "# DR-NNN: Title"`);
  return {
    slug,
    id: m[1],
    title: m[2],
    status: field(md, "Status"),
    decided: field(md, "Decided"),
    scope: field(md, "Scope"),
    body: md.slice(first.length).trim(),
  };
}

export const listDecisions = cache(async (): Promise<DecisionRecord[]> => {
  const dir = path.join(CONTENT, "decisions");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  return Promise.all(
    files.map(async (f) => parseDecision(f.replace(/\.md$/, ""), await readFile(path.join(dir, f), "utf8"))),
  );
});

export async function getDecision(slug: string): Promise<DecisionRecord | null> {
  return (await listDecisions()).find((d) => d.slug === slug) ?? null;
}

export const getModelCard = cache(async (): Promise<{ title: string; body: string }> => {
  const md = await readFile(path.join(CONTENT, "model-card.md"), "utf8");
  const first = md.split("\n", 1)[0];
  return { title: first.replace(/^# /, ""), body: md.slice(first.length).trim() };
});
