# ADR-0002 — PostgreSQL with Prisma as the single source of truth

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

The data model must handle: a versioned curriculum graph (concepts with prerequisites, lessons,
exercise payloads of varying shape), high-volume append-only attempt logs, per-user FSRS
scheduling state, an error history that feeds an LLM context builder, usage/cost metering, and
eventually text embeddings for content retrieval.

The shapes are mixed. Curriculum and progress are deeply relational and need transactional
integrity: grading an answer writes an attempt, updates mastery, appends a review log, records an
error, and increments usage, and any partial application corrupts learner progress. Exercise
payloads and AI session metadata are genuinely schemaless and will change weekly.

We need one database, not three, because the team is small and joins across these domains are
constant ("this learner's recent errors, joined to the concepts they belong to").

## Decision

**PostgreSQL as the only datastore**, with `pgvector` in the same instance for content
embeddings. **Prisma** as the ORM and migration tool.

- Relational tables for identity, curriculum, progress, mastery, scheduling, and metering.
- `jsonb` for exercise payloads, answer specs, AI session metadata, and model config — fields
  that are read as a whole and rarely queried by inner structure.
- `pgvector` for authored-content embeddings, queried only in `doubt_resolution` mode. No
  separate vector database.
- Append-only tables (`exercise_attempt`, `review_log`, `usage_ledger`) are the source of truth;
  rollups (`activity_day`, `usage_counter`) are derived and rebuildable.
- Neon as the managed host, primarily for database branching — every PR preview environment gets
  an isolated branch, which eliminates the shared-staging-database problem before it starts.
- `uuidv7()` primary keys for time-ordered, index-friendly identifiers.

## Consequences

**Positive**

- **Transactions give us learner-progress correctness for free.** The multi-table write on every
  graded attempt is atomic; this is non-negotiable and no document database gives it as cheaply.
- One consistency model for the whole team. No "which store is authoritative" bug class.
- Deep relational queries (weak concepts joined to error categories, due items joined to
  prerequisite mastery) are one SQL statement, not an application-side join.
- Postgres already provides full-text search, JSONB, partitioning, and mature backup tooling.
  Nothing in the MVP needs a specialized store.
- `pgvector` avoids a second service and a second consistency problem while retrieval volume is
  small.
- Neon branching makes preview environments real, which measurably reduces late-stage
  integration bugs.

**Negative**

- Prisma's query builder does not cover every Postgres feature. Analytic window functions and
  some index types require `$queryRaw`, which sits outside the type-safe layer.
- Prisma migrations are less expressive than hand-written SQL for online schema changes.
  Zero-downtime migrations need hand-written SQL for large tables.
- Single-instance contention: OLTP requests and analytic rollup queries share one database. The
  `activity_day` rollup exists specifically to keep analytics off the request path.
- `exercise_attempt` will require partitioning at ~50M rows. Prisma does not manage partitions,
  so that migration is raw SQL.
- Postgres + Neon becomes a single point of failure for the entire product.

## Alternatives considered

- **MongoDB / document store.** Rejected: progress correctness depends on multi-document
  transactions, and the curriculum is a graph with real relationships. We would trade query
  power for flexibility we already get from `jsonb`.
- **Drizzle instead of Prisma.** Genuinely close. Drizzle is SQL-first, lighter, and handles raw
  SQL more gracefully. Prisma wins on migration ergonomics, documentation, and hiring pool,
  which matter more to a small team than SQL purity. Worth revisiting if Prisma's abstraction
  costs us a Postgres feature we need.
- **Separate vector database (Pinecone, Qdrant).** Rejected: at our content volume the retrieval
  corpus is thousands of chunks, not millions. A second service adds operational cost and a
  consistency problem for a latency gain we do not need.
- **Redis as a primary store for session/learner state.** Rejected: durability. Redis holds only
  derived and ephemeral state (rate limits, counters, caches) that can be rebuilt.
- **Supabase for database + auth + storage.** Rejected as a _bundle_: it would couple our auth
  and storage choices to the database vendor. Reusing its Postgres is fine.

## Review trigger

Revisit when: analytic queries degrade API p95 (introduce a read replica or a warehouse), the
attempt table's partitioning burden becomes unmanageable, or Prisma blocks a Postgres capability
we need. If we adopt a data warehouse later, `usage_ledger` and `activity_day` are the first
things to replicate out.
