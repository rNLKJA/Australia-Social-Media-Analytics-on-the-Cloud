# DR-002: Ship the data as a read-only SQLite file inside the serverless functions

- **Status:** accepted; extended on 6 October 2026 for model-written SQL
- **Decided:** October 2026, during the revival (recorded on 6 October 2026)
- **Scope:** `web/data/analytics.db`, `web/src/server/db.ts`, `web/src/server/sql/`, `web/next.config.ts`

## Context

Every number on the site comes from about 1.7 MB of aggregates. The site has no accounts, no forms and no writes. It is deployed to Vercel, where a function's file system is read-only outside `/tmp`. The records pages need search, sorting, pagination and CSV export, and the 2026 upgrade adds a feature that runs SQL written by a visitor's language model.

## Decision

Bundle `analytics.db` with the server functions (`outputFileTracingIncludes`), copy it to `/tmp` once per cold start on Vercel, and read it with libSQL. Nothing ever writes to it. For model-written SQL, add a second, stricter path: a fresh connection per query with `PRAGMA query_only`, the statement wrapped as `SELECT * FROM (...) LIMIT 201`, and a timer that interrupts SQLite after 2.5 seconds, behind a validator that only lets a single allow-listed SELECT through.

## Options considered

1. **A hosted database** (Turso, Postgres on Neon or Vercel). Real query isolation and per-user roles, but an account, a network hop, credentials to manage and limits to watch, for data that never changes.
2. **Static JSON files.** No server at all, but no ad hoc queries: the records search and the text-to-SQL feature would need a database anyway.
3. **SQLite compiled to WebAssembly in the browser.** Model-written SQL would never touch a server, but every visitor would download the whole database, and the validation would run where the visitor controls it.
4. **A bundled, read-only SQLite file.** Chosen.

## Why

The data is small, static and public, so a file that ships with the code is the simplest thing that works: builds are deterministic, the same file opens in any SQLite browser, and there is no infrastructure to keep alive or credentials to leak. For model-written SQL the guarantees have to come from somewhere other than a database role, so they are layered: the validator decides what may run, `query_only` makes SQLite itself refuse writes, the wrapper and libSQL's one-statement `prepare` mean only that one SELECT can execute, and `sqlite3_interrupt` bounds its run time. On Vercel the file is also a throwaway copy in `/tmp`.

## What happened

- Cold starts copy the file in about 2 ms; static pages read it at build time, so only the records pages and `/api/sql` touch it at request time.
- The tests run the real executor against the real file: writes fail with `SQLITE_READONLY`, an `ATTACH` smuggled after a closing parenthesis never runs (libSQL compiles only the first statement), the database is unchanged afterwards, and a deliberately explosive cross join is interrupted at 200 ms in the test (2.5 s in production).
- I tried to use SQLite's authorizer as a second allow-list. libSQL's binding only accepts table rules and denies every function, including `COUNT`, so it could not be used; the function allow-list lives in the validator instead. That is a weaker guarantee than an authorizer would have been, and the tests carry the weight.
- Review before merge showed that rows and time were not enough. Allowed functions (`REPLACE`, `GROUP_CONCAT`) can build a string of up to SQLite's 1 GB limit well inside 2.5 seconds: one nested `REPLACE` query took the server from 147 MB to 2.2 GB of memory in 1.2 s. SQLite's heap is now capped at 64 MB with `PRAGMA hard_heap_limit`, and such a query fails with a "query too large" message instead. The cap is process-wide, so one oversized query can make a concurrent query on the same instance fail too; with a 1.7 MB database no legitimate query comes near it.
- There is no rate limit on `/api/sql` beyond Vercel's own function limits. Each query is capped at 200 rows, 2.5 seconds and 64 MB, so the cost of one query is bounded; the number of queries is not.

## What I'd change

- Put a rate limit in front of `/api/sql` (Vercel Firewall or a small token bucket keyed by IP).
- Open the file with SQLite's read-only flag as well as `query_only`, when the binding exposes it.
- Revisit the WebAssembly option if the database ever grows a private table: then nothing but public aggregates should ever be reachable, and the current single-file design would need splitting.
