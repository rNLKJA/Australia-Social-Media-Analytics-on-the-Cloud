# DR-004: Replace the 2023 client-side ChatGPT pop-up with bring-your-own-key text-to-SQL and server-side validation

- **Status:** accepted
- **Decided:** 6 October 2026
- **Scope:** `/ask`, `/ask/eval`, `/ai-log`, `web/src/lib/ai/`, `web/src/server/sql/`, `POST /api/sql`

## Context

The 2023 frontend contains a "Chat with GPT" pop-up (`coursework/2_ReactJS_frontend/frontend/src/navbar/GPTPopUp.jsx`). It read an OpenAI key from a `REACT_APP_` build variable, which Create React App inlines into the public JavaScript bundle, so any visitor could have copied it. It posted to the Chat Completions endpoint without a model, read `choices[0].text` (the older completions shape), sent messages with an invalid `gpt` role, capped replies at 50 tokens, knew nothing about the project's data and logged nothing. It was commented out of the navigation bar and never shipped. The revival has no budget for AI, and the 2026 upgrade needs to show what responsible use of a language model looks like, not just that one can be called.

## Decision

The site holds no AI key and runs no AI on its servers. A visitor who wants the feature brings their own key (Anthropic by default, with Claude Haiku 4.5 or Sonnet 5.5; or OpenAI with a model id they choose). The key stays in their browser, in sessionStorage unless they choose to keep it on the device, and calls go straight from the browser to the provider. The model never touches the database: it returns one SQL query in a schema-validated structured output, and only that SQL is sent to this site, where a validator allows a single SELECT on documented tables and columns, and SQLite runs it read-only with a row cap and a time limit. A second call explains the rows and must cite them. Every output is labelled AI-generated, every call is recorded in an audit log in the visitor's browser with export, the person accepts, edits or rejects the answer, and a benchmark with hand-written gold SQL measures how often the model gets it right.

## Options considered

1. **Revive the pop-up with a site key.** Costs money the project does not have, and a key in the browser is a key for everyone.
2. **A server-side proxy holding a site key, with rate limits.** Protects the key but still costs money, and invites abuse of an open AI endpoint.
3. **A server-side proxy for the visitor's key.** No cost to the site, but every key would pass through this server, which then has to be trusted not to log or leak it.
4. **Bring your own key, called from the browser, with the risky step (running model output) constrained on the server.** Chosen.
5. **No AI at all.** Safe, and the site is fully usable this way, but it would not demonstrate how to govern a model that writes code against real data.

## Why

Option 4 costs nothing, keeps keys off infrastructure the visitor does not control, and puts the controls where they matter: the model can only propose, the server decides what runs, and the person decides what to keep. The design is informed by the transparency principles in the Australian Government's policy for the responsible use of AI in government (a published statement of how AI is used), the EU AI Act's transparency obligations for AI-generated content, and the NIST AI Risk Management Framework's map, measure and manage functions. It does not claim compliance with any of them; it borrows their questions. What does the AI do, what does it never do, what data goes where, how is it measured, and who decides?

## What happened

- The validator blocks every adversarial case in its tests (writes, PRAGMA, ATTACH, stacked statements, schema tables, table-valued functions, unsafe functions such as `load_extension`, `randomblob` and `printf`, recursive CTEs, comment and escape tricks), and the gold SQL for all 14 answerable benchmark questions passes it. `/api/sql` refuses any request that carries an API key header or any field besides the SQL.
- A Content Security Policy limits the page's requests (`connect-src`) to this site, the two AI providers and the map tiles, and its images to this site, so the usual quiet channels for sending a stolen key elsewhere are closed. It is a partial measure: without a nonce-based `script-src`, an injected script could still navigate away with a key, so the real protection is that the site loads no third-party scripts.
- I could not run the benchmark against real models, because the project has no AI budget and does not use anyone else's key. No accuracy figures are published. The harness reports execution accuracy with Wilson 95% intervals, the refusal rate on the two unanswerable questions, the share of blocked or failing SQL, latency and tokens, and compares two runs with an exact McNemar test, for anyone who runs it with their own key.
- With 14 scored questions a Wilson interval is up to about ±25 percentage points wide. The harness says so on the page: it is a smoke test, not a leaderboard.
- Review before merge found three gaps, now fixed and tested. First, the validator only blocked the `RECURSIVE` keyword, but SQLite treats any CTE that refers to itself as recursive, so `WITH c AS (SELECT 1 AS x UNION ALL SELECT x + 1 FROM c) ...` got through and ran until the timeout. Each CTE body is now checked before its own name comes into scope, so self-references and forward references are refused. Second, the harness scored malformed, truncated and refused replies as provider errors and dropped them from every denominator: a mocked run with 13 of 14 malformed replies showed "1/1 = 100%". Those replies now count as wrong, their tokens and time are kept, and only infrastructure failures are left out. Third, accepting or rejecting an answer rewrote the record's time and latency, and re-running edited SQL overwrote the model's first answer. Records are now written once; only the decision is updated, and a re-run is a new record linked to the original.
- The paired comparison now shows the accuracy difference with a Tango score 95% interval, checked against R's `PropCIs::scoreci.mp`, next to the McNemar p-value.
- The answer step checks that the model's citations point at rows that were actually returned and flags answers that cite none. It cannot check that a cited row says what the sentence claims; the person still has to read the table.

## What I'd change

- Grow the benchmark to 50 or more questions with a held-out half, so prompt changes cannot be tuned to the test.
- Make the audit log tamper-evident (hash-chain the records) and optionally exportable to a place the visitor controls, since a browser-only log disappears with the site data.
- Re-check the default model ids each quarter; they age faster than the rest of the site.
- Show the provider's own data-retention terms next to the key field, so the person knows what the provider keeps.
- Move to a nonce-based `script-src` policy, which closes the remaining exfiltration route.
