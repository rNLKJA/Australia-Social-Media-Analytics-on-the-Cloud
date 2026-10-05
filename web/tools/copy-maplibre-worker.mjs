// MapLibre GL v6 runs its tile parsing in an ES-module Web Worker that it
// locates relative to its own module URL, which bundlers rewrite. Copy the
// worker (and the shared chunk it imports) into public/ so the app can point
// MapLibre at a stable same-origin URL via setWorkerUrl().
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = path.join(import.meta.dirname, "..", "public", "vendor", "maplibre");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, f), path.join(out, f));
}
console.log(`[copy-maplibre-worker] copied worker to ${path.relative(process.cwd(), out)}`);
