# ADR-0003 — REST with Zod-generated OpenAPI over GraphQL and tRPC

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

One API serves a Next.js web client now and a mobile client later. The API is also the boundary
the AI layer sits behind, and it carries Server-Sent Events for streamed mentor replies. It is a
public-ish product API, not an internal RPC surface.

The team is small and TypeScript-only, which makes `tRPC` tempting for the compile-time
guarantees. The client needs a small number of predictable, cacheable reads (catalog, progress)
and a few write-heavy streams (attempt submission, tutor turns).

## Decision

**REST over HTTPS with JSON bodies, versioned under `/v1`, with Zod as the single source of
truth.** OpenAPI is generated from the Zod schemas in `packages/types`; client types are inferred
from the same schemas. No hand-written API types exist anywhere in the repo.

Conventions are fixed in `03-api-contracts.md`: cursor pagination, RFC 9457 problem+json errors
with stable machine-readable codes, `Idempotency-Key` on retryable mutations, SSE for streams,
`ETag` on cacheable catalog reads, and a hard rule that `answer_spec` is never serialized to a
client.

## Consequences

**Positive**

- **One schema definition produces runtime validation, static types, and the OpenAPI document.**
  Nothing can drift, because there is nothing to drift from.
- HTTP semantics give us real caching for free where it belongs (catalog and concept reads are
  `ETag` + CDN cacheable), and explicit `no-store` where it belongs (learner data).
- SSE works with plain HTTP infrastructure: it survives proxies, needs no upgrade handshake, and
  the client can consume it with `EventSource` or a fetch stream. GraphQL subscriptions and tRPC
  streaming would both require additional transport plumbing.
- Any future client (mobile, CLI, partner integration) can consume it without sharing our
  TypeScript. This is the reason `tRPC` loses.
- Status codes carry meaning operationally: `402` for quota exhaustion and `429` for rate limits
  are distinguishable in logs, dashboards, and client behaviour.

**Negative**

- No compile-time guarantee that the route handler actually returns what the schema declares. Zod
  response validation in tests closes most of this gap but costs runtime overhead if done in
  production.
- The mobile client will make several round trips for a dashboard that a GraphQL query could
  fetch in one. Mitigated where it matters: `POST /v1/attempts` returns `next_items` inline,
  removing ~40% of hot-loop round trips.
- OpenAPI generation must be maintained; a broken generator breaks the client build.
- REST versioning (`/v1`) means breaking changes require a parallel surface rather than schema
  evolution. Accepted: it also makes breaking changes deliberately expensive.

## Alternatives considered

- **tRPC.** Best developer experience for a pure TypeScript monorepo, and the fastest path for
  the web client. Rejected because it makes the server's TypeScript the API contract, which
  hard-blocks a non-TypeScript client and leaks internal types (Prisma models) into the public
  surface. Reversing that later is a rewrite of every call site.
- **GraphQL.** Rejected: solves over-fetching we do not have, adds a resolver layer, a schema
  build step, mandatory query-depth and cost-limiting for abuse protection, and awkward
  server-to-client streaming. Real cost now for speculative benefit.
- **oRPC / ts-rest.** ts-rest is the closest runner-up — it also derives OpenAPI from Zod and
  keeps a type-safe client. Rejected only because Fastify + plain Zod schemas is one fewer
  abstraction and the team already knows it.
- **gRPC.** Rejected: browser-unfriendly, and we have no low-latency service-to-service calls.
- **WebSockets for the text stream.** Rejected for R0: SSE is unidirectional, auto-reconnects,
  and needs no connection registry. WebSockets arrive with R1's audio path, where a persistent
  bidirectional channel is genuinely required.

## Review trigger

Revisit if a second client needs deep aggregate queries that REST rounds-trips badly, or if
response-shape drift between handler and schema causes a production incident twice. The escape
hatch is a dedicated read endpoint returning a composed view model, not a protocol change.
