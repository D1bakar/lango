# ADR-0001 — Monorepo with a modular monolith and a separate worker

- **Status:** Accepted
- **Date:** 2026-09-20
- **Supersedes:** none

## Context

A team of 5–8 engineers must build a product spanning a web client, an HTTP API, background jobs
(audio generation, SRS rollups, pack import, analytics), and an AI layer. The system is expected
to grow into voice and eventually video. We must avoid both a tangled single deployable and a
premature microservice fleet that a small team cannot operate.

Two forces pull in opposite directions. Independent deployability reduces blast radius and lets
components scale separately. But every additional deployable multiplies operational surface:
another CI pipeline, another set of secrets, another thing that pages someone at 2am. With 5–8
engineers, distributed-systems debugging is the most expensive activity available, and the team
has no dedicated platform engineer.

## Decision

A single repository containing a **modular monolith** (`apps/api`), a **worker** (`apps/worker`),
and the web client (`apps/web`), plus shared packages. Boundaries are enforced by lint rules and
package dependency direction rather than by the network.

- `packages/core` holds domain logic and MUST NOT import Fastify, Next.js, React, or any provider
  SDK. It is pure and unit-testable without a server.
- `packages/ai` holds the context builder, prompt registry, model router, tools, and guardrails.
  Provider SDKs are imported only inside `packages/ai/providers/*`.
- `apps/api` orchestrates. Route handlers contain no domain rules.
- `apps/web` may import only `packages/types` and `packages/ui`. It cannot import `db` or `ai`.
- No cross-imports between apps. Violations fail CI via `eslint-plugin-boundaries`.

The worker is separate from the API from day one because background work must not compete with
request latency, and because a runaway job should not take down the API. That is the only
premature split we accept.

## Consequences

**Positive**

- Cross-cutting changes (a schema field used by API, worker, and web) land in one PR and one CI
  run. This is the dominant mode of change in a product this young.
- Shared Zod schemas give compile-time safety across the client/server boundary with no code
  generation step to maintain.
- Local development is one command. Onboarding a new engineer is hours, not days.
- Five deployables' worth of operational work is avoided while the product is still finding fit.
- The extraction seams we might need later are real and cheap because dependency direction is
  already enforced: `packages/ai` can become a service, and pronunciation scoring can become a
  Python service, without touching callers.

**Negative**

- All API modules share a deploy unit. A memory leak in one module affects all routes. Mitigated
  by the worker split, per-route timeouts, and load tests in CI.
- A single Postgres instance is a shared failure domain and a shared contention domain.
- Lint-enforced boundaries are weaker than process boundaries. They catch the honest mistake, not
  a determined shortcut.
- The monorepo will get slow as it grows; Turborepo caching is required, not optional.

## Alternatives considered

- **Microservices from the start.** Rejected: 5–8 engineers cannot operate 6–10 services and
  still ship product. The failure mode is a team that spends all its time on infrastructure.
- **Single Next.js app with API routes.** Rejected: route handlers are a poor host for long-lived
  connections, connection pooling, and a mobile-ready API contract, and business logic ends up
  coupled to the framework. Migrating later is a rewrite.
- **Separate repos per app.** Rejected: forces versioned internal packages and cross-repo PR
  coordination for exactly the shared-change pattern that dominates this product.
- **Nx instead of pnpm + Turborepo.** Rejected: heavier, more configuration, and no capability we
  need that Turborepo lacks.

## Review trigger

Revisit when the team exceeds ~8 engineers, when a module needs to scale independently of the
rest, or when a single module's failure repeatedly affects unrelated routes.
