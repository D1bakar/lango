# Architecture Decision Records

One file per decision. Format: Context → Decision → Consequences (good and bad) →
Alternatives considered → Review trigger.

A decision is superseded by writing a new ADR that references it. Do not edit the consequences
of an accepted ADR in place.

| ADR                                              | Decision                                                         | Status   | Review trigger                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| [0001](./0001-monorepo-modular-monolith.md)      | Monorepo, modular monolith + worker                              | Accepted | >8 engineers or a second product surface                                          |
| [0002](./0002-postgres-prisma.md)                | PostgreSQL + Prisma as single source of truth                    | Accepted | Analytics workload degrades OLTP; Prisma blocks a required Postgres feature       |
| [0003](./0003-rest-zod-openapi.md)               | REST + Zod/OpenAPI over GraphQL and tRPC                         | Accepted | A second client needs deep aggregate queries that REST rounds-trip badly          |
| [0004](./0004-grounded-learner-model-ai.md)      | Grounded learner-model AI with structured outputs and eval gates | Accepted | Model capability makes grounding unnecessary (unlikely); eval cost exceeds value  |
| [0005](./0005-livekit-webrtc-staged-realtime.md) | WebRTC via LiveKit; staged R0 → R1 → R2                          | Accepted | R0 proves voice adds no learning value; LiveKit cost or self-host burden too high |
| [0006](./0006-apache2-code-ccbync-content.md)    | Apache-2.0 code, CC BY-NC content, CLA                           | Accepted | Content contributions suppressed by the NC term                                   |
| [0007](./0007-fsrs-scheduling.md)                | FSRS over SM-2 for review scheduling                             | Accepted | Retention data shows no gain over SM-2 for the effort                             |
| [0008](./0008-multilanguage-as-data.md)          | Multi-language as data; community language packs                 | Accepted | Pack format proves too rigid for a second language family                         |
| [0009](./0009-usage-metering-in-mvp.md)          | Usage metering and voice quotas ship in MVP                      | Accepted | Never — this is a cost-existential control                                        |

## ADRs deliberately not written

- **Server-side grading / never ship answer specs to the client.** This is a security
  principle with no reasonable alternative, not a decision. Recorded in `03-api-contracts.md`.
- **Deployment platform choice.** Reversible in a week; revisit at Phase 6.
- **Design system choice.** Reversible; not architecturally consequential.
