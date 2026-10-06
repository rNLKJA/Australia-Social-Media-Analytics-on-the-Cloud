// Mirror ../docs (the canonical decision records and model card) into
// content/, because a Vercel deployment of web/ cannot read files outside it.
// Run after editing anything in docs/:  node tools/sync-docs.mjs
// src/lib/content.test.ts fails when the two copies differ.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const docs = path.resolve(web, "..", "docs");
const out = path.join(web, "content");

if (!existsSync(docs)) {
  console.log("[sync-docs] ../docs not found; leaving content/ as it is");
  process.exit(0);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "decisions"), { recursive: true });
copyFileSync(path.join(docs, "model-card.md"), path.join(out, "model-card.md"));
for (const f of readdirSync(path.join(docs, "decisions")).filter((f) => f.endsWith(".md"))) {
  copyFileSync(path.join(docs, "decisions", f), path.join(out, "decisions", f));
}
console.log("[sync-docs] mirrored docs/ into web/content/");
