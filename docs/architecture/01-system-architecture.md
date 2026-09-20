# 01 — System architecture

## Deployment units

Four units at MVP. This is a modular monolith plus a worker, not microservices.

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/web — Next.js (App Router)                                     │
│  marketing · auth UI · dashboard · lesson player · mentor UI         │
│  Renders SSR/streamed HTML. Owns no business logic.                  │
└───────────────┬──────────────────────────────────────────────────────┘
                │ HTTPS (JSON + SSE)          WSS (V1: LiveKit)
┌───────────────▼──────────────────────────────────────────────────────┐
│  apps/api — Fastify + Node 22                                        │
│  auth · profiles · catalog · learning · progress · tutor · quota      │
│  Server-side grading. Owns all authorization. Long-lived process.     │
└───────┬────────────────────┬───────────────────────┬─────────────────┘
        │                    │                       │
┌───────▼──────┐   ┌─────────▼─────────┐   ┌─────────▼─────────────────┐
│  PostgreSQL  │   │  Redis            │   │  packages/ai              │
│  (Neon)      │   │  rate limits      │   │  context builder · router │
│  + pgvector  │   │  quota counters   │   │  prompts · tools · evals  │
│              │   │  session cache    │   │  (in-process at MVP)      │
└──────────────┘   └─────────┬─────────┘   └─────────┬─────────────────┘
                             │                       │
                    ┌────────▼────────┐    ┌─────────▼─────────────────┐
                    │  apps/worker    │    │  External providers       │
                    │  BullMQ         │    │  LLM · STT · TTS · R2     │
                    │  audio gen      │    │  Sentry · PostHog         │
                    │  SRS rollups    │    │  Langfuse                 │
                    │  pack import    │    └───────────────────────────┘
                    │  summaries      │
                    └─────────────────┘
```

**Why `packages/ai` is a package, not a service.** It runs in the API process at MVP. It is
isolated behind interfaces so it can be extracted to its own deployable (or to Python for
phoneme scoring) without touching callers. See ADR-0004.

**Why the API is not Next.js route handlers.** Long-lived connections, a stable contract for a
future mobile client, connection pooling, and independent scaling from the web tier.

**Why there is no `realtime-agent` unit yet.** R0 has no persistent connection. R1 adds
`apps/realtime-agent` as a fifth unit; its contract is reserved in `03-api-contracts.md`.

## Package boundaries

```
packages/core      domain logic: grading, FSRS, quota rules, XP/streak rules, idempotency
packages/db        Prisma schema + client, migrations, seed
packages/ai        context builder, prompt registry, model router, tools, guardrails, evals
packages/types     Zod schemas + inferred TS types. Source of OpenAPI and client types.
packages/ui        design system primitives
packages/config    runtime environment schema, validated at boot. Shared eslint and
                   tsconfig presets live at the repository root instead, so flat
                   config resolves from every package.
content/           language packs (YAML). Not imported by code; loaded by the import job.
```

At Phase 2 only `packages/config` and `packages/types` exist, plus `apps/api`. Every
other package arrives with the phase that needs it — an empty package is not a plan.

## Dependency rules (enforced by eslint boundaries)

1. `packages/types` depends on nothing in the repo. It is the shared vocabulary.
2. `packages/core` may import `types` and `db`. It **MUST NOT** import `fastify`, `next`,
   `react`, or any provider SDK. It is pure domain logic and must be unit-testable without a
   server.
3. `packages/ai` may import `types`, `db`, `core`. Provider SDKs are imported **only** inside
   `packages/ai/providers/*`, never in a route handler.
4. `apps/api` may import everything except `apps/web`. Route handlers orchestrate; they contain
   no domain rules.
5. `apps/web` may import `types` and `ui` only. **It MUST NOT import `db` or `ai`.** The client
   is a consumer of the API contract.
6. No cross-imports between `apps/*`.

A violation of any rule above fails CI (`eslint-plugin-boundaries`).

## Request path for a graded attempt (the hot path)

```
POST /v1/attempts
  → auth middleware: verify access token, load learner context
  → quota middleware: reject if hard-blocked (402)
  → Zod parse body (types) ───────────────────────────► 422 on failure
  → core.grading.grade(exercise, response, languageProfile)
        uses normalization_profile + answer_spec; never trusts client correctness
  → core.fsrs.review() → produces concept_mastery delta
  → single transaction: exercise_attempt + concept_mastery + review_log + error_record + usage
  → 200 { is_correct, corrections[], concept_updates[], next_items[] }
```

Target: p95 < 150ms, no external AI call. Grading is deliberately **not** an LLM call — it is
deterministic and cheap. LLM grading is reserved for free-form production (mentor, `speak_free`)
where a deterministic answer does not exist.

## Third-party dependency policy

Every provider (LLM, STT, TTS, storage, email) sits behind an interface in
`packages/ai/providers` or `packages/core/adapters`. Swapping a provider must be a config and
adapter change, never a change to a route handler or the domain layer. This is a hard rule
because voice unit economics will force provider changes repeatedly.

## What we deliberately did not build

- **No microservices at MVP.** One API, one worker, one database.
- **No Kubernetes.** Docker images on a managed platform.
- **No GraphQL.** See ADR-0003.
- **No separate vector database.** `pgvector` in the same Postgres.
- **No event bus beyond BullMQ.** Domain events are rows, not Kafka topics.
- **No Python service.** Extracted only when phoneme-level pronunciation scoring lands (V1).

## Extraction seams (planned, not built)

| Seam                             | Extract when                                          | Cost of extraction                             |
| -------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| `packages/ai` → service          | AI calls dominate API CPU or need independent scaling | Low — interface already exists                 |
| Pronunciation scoring → Python   | V1 phoneme scoring                                    | Medium — new deployable, new provider contract |
| `apps/realtime-agent`            | R1 streaming duplex                                   | Medium — new unit, reuses `packages/ai`        |
| Read models → materialized views | Dashboard p95 degrades                                | Low — same database                            |
