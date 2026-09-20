# Lingua

> **Working name.** `Lingua` is a placeholder chosen so the repository could be
> scaffolded. Renaming it means the package scope (`@lingua/*`), this file, and
> the copyright line in `LICENSE`. Settle the real name before the first public
> release, not after third-party clients depend on the API.

An AI-mentored language learning platform: a structured curriculum that teaches,
and a persistent AI mentor that corrects, explains, and practises with you.

## The problem

Self-learners plateau for three reasons. Nobody corrects what they actually
produce. They cannot ask "why is this sentence built this way?" at the moment
they need to know. And most apps optimise for recognising the right answer
rather than producing it.

Human tutors solve all three, and cost money and scheduling. The gap is
immediate, personal, corrective feedback that a learner does not have to book.

## What makes this different

Not the language model. Any competitor can call the same model.

The difference is a **learner model**: a per-user graph of concepts that are
introduced, practised, mastered, or decaying; a classified history of the
mistakes that learner actually makes; and a spaced-repetition schedule — all of
which is assembled into the mentor's context before every single turn.

That has three consequences a chat wrapper cannot reproduce:

1. **The mentor knows what you have learned.** It stays inside the lesson's
   concepts and its output is capped at your level, so it never answers with
   grammar you have not met yet.
2. **Corrections are structured data, not prose.** A correction arrives with a
   span, a category, a severity, and the authored concept that supports it, so
   the interface can render an inline grammar card and track the weakness rather
   than burying it in a chat log.
3. **Explanations are grounded in authored content.** The mentor may only cite
   teaching material that a human wrote and reviewed. A correction asserting a
   rule we cannot cite is suppressed and logged for review, because a confident
   wrong explanation in a language you cannot yet verify is worse than silence.

## Status

Early, and deliberately honest about it. The foundation is built and tested; the
teaching is not written yet.

| Phase                                  | State                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| 0 — product definition                 | complete                                                                     |
| 1 — architecture                       | complete, see `docs/architecture/`                                           |
| 2 — repository base                    | complete: tooling, contracts, governance, CI                                 |
| 3 — foundation                         | the catalog read path and a preview UI exist; auth and the database are next |
| 4+ — learning engine, AI mentor, voice | not started                                                                  |

**What works today:** choosing a language, level, and goal, driven by real
content files and a validated contract between the API and the client.

**What does not:** lessons, the mentor, voice, and accounts. Nothing you click is
saved.

## Repository layout

```
apps/
  api/                  HTTP API: catalog reads today; auth, grading, quota later
  web/                  Next.js client. No business logic, no database access
packages/
  config/               typed runtime environment validation
  core/                 domain logic: content loading and validation
  types/                Zod schemas. The single source of truth for every contract
content/                language packs (YAML), licensed separately
docs/architecture/      design documents and architecture decision records
```

Not yet present: `apps/worker`, `packages/db`, `packages/ai`, `packages/ui`.
Each arrives when there is something real to put in it — see the extraction seams
in `docs/architecture/01-system-architecture.md`.

## Quick start

Requires **Node.js 22** and **pnpm**. Enable pnpm through corepack, which reads
the pinned version from `package.json`:

```bash
corepack enable
pnpm install
```

`corepack enable` is a one-time step. It is also required for `turbo` to run
package scripts, because turbo shell-outs to the package manager.

**If `pnpm: command not found`,** either run `corepack enable` (which may need
administrator rights on Windows) or prefix every command with `corepack`, for
example `corepack pnpm dev`. Both work; only plain `pnpm` requires the one-time
enable.

## Run it

```bash
cp .env.example .env
pnpm dev          # or: corepack pnpm dev
```

That starts both servers:

|     | URL                   |
| --- | --------------------- |
| Web | http://localhost:3000 |
| API | http://localhost:3001 |

Worth opening:

- `/` — what this is
- `/learn` — choose a language, level, and goal, from live content
- `/status` — what the running API actually loaded

Run one side alone with `pnpm --filter @lingua/web dev` or
`pnpm --filter @lingua/api dev`.

The API has no required infrastructure yet: every environment variable has a
development default, so it starts with an empty `.env`. `DATABASE_URL`,
`REDIS_URL`, and `AUTH_SECRET` become required in Phase 3, enforced by the schema
in `packages/config/src/env.ts`.

### API surface

```
GET /health                      liveness
GET /v1/languages                every language, with how many packs start from or teach it
GET /v1/languages/:tag/pairs     targets reachable from a native language, with their packs
GET /v1/content/status           counts of what the running process loaded
```

## Verify

```bash
pnpm verify        # formatting, lint, typecheck, tests
pnpm test          # tests only
pnpm typecheck     # types only
pnpm lint          # lint only
pnpm format        # rewrite files with prettier
```

Run `pnpm verify` before opening a pull request. CI runs the same pipeline plus
license-header, content-boundary, DCO, and commit-message checks.

## Architecture

Start with `docs/architecture/README.md`. The decisions that constrain
everything else are recorded as ADRs in `docs/architecture/adr/`, each with the
alternatives that were rejected and the trigger that should make us revisit it.

Three rules matter more than the rest, and all three are enforced by tooling
rather than by good intentions:

- **Dependency direction.** `packages/types` imports nothing from this
  repository and lint rejects it if it tries. `apps/web` never imports the
  database or AI layers.
- **The answer key never leaves the server.** Grading is server-side and
  `answer_spec` is never serialised to a client.
- **Content is validated before it is used.** `packages/core` refuses to load a
  content tree with a broken reference, a pack filed under the wrong key, or a
  pack marked published without a fluent reviewer.

## Contributing

See `CONTRIBUTING.md`. All contributions require a `Signed-off-by` line
(`git commit -s`), and content contributions are reviewed by a fluent speaker of
the target language.

## License

Two licenses, split by directory:

| Path                              | License                          |
| --------------------------------- | -------------------------------- |
| `apps/**`, `packages/**`, tooling | Apache-2.0 (`LICENSE`)           |
| `content/**`                      | CC BY-NC-4.0 (`content/LICENSE`) |

The code is permissively licensed. The authored curriculum is not available for
commercial use without a separate agreement, because it is the expensive part to
produce. See `docs/architecture/adr/0006-apache2-code-ccbync-content.md`.
