# Self-hosted fonts

These are the latin subsets of the site's three typefaces. They are loaded with `next/font/local` in `src/app/layout.tsx`, so a build never has to reach Google Fonts. The Open Graph card reads its own WOFF files from `assets/fonts`, because Satori cannot read WOFF2.

| File                                          | Source package (npm pack)                | Axes or weights               | Variable             |
| --------------------------------------------- | ---------------------------------------- | ----------------------------- | -------------------- |
| `newsreader-latin-opsz-{normal,italic}.woff2` | `@fontsource-variable/newsreader@5.3.0`  | wght 200 to 800, opsz 6 to 72 | `--font-newsreader`  |
| `public-sans-latin-wght-normal.woff2`         | `@fontsource-variable/public-sans@5.3.0` | wght 100 to 900               | `--font-public-sans` |
| `ibm-plex-mono-latin-{400,500}-normal.woff2`  | `@fontsource/ibm-plex-mono@5.3.0`        | 400 and 500                   | `--font-plex-mono`   |

All three families are licensed under the SIL Open Font License 1.1. The licence for each family sits next to its files as `OFL-*.txt`.
