# web/

The deployable Next.js app for **Social Sense (revived)**. See the [root README](../README.md) for the project overview, data provenance and how the artefacts in `data/` and `public/` are generated.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Statistics are verified against Python (`uv run ../scripts/verify_stats.py` writes the reference fixture). After editing `../docs/`, run `node tools/sync-docs.mjs` so `/methods` shows the same text. The optional AI features need no configuration: visitors bring their own key in the browser.
