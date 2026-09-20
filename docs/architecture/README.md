# Architecture

Design documentation for the project. **No application code exists yet** — these documents
are the contract we build against. Read them in order; each one assumes the previous.

| #   | Document                                           | Contents                                                     | Status   |
| --- | -------------------------------------------------- | ------------------------------------------------------------ | -------- |
| 01  | [System architecture](./01-system-architecture.md) | Deployment units, module boundaries, dependency rules        | Draft    |
| 02  | [Data model](./02-data-model.md)                   | Multi-language ERD, field specs, indexes, content versioning | Draft    |
| 03  | [API contracts](./03-api-contracts.md)             | REST resources, auth, errors, streaming, quota semantics     | Draft    |
| 04  | [AI contracts](./04-ai-contracts.md)               | LearnerContext, correction schema, tools, guardrails, evals  | Draft    |
| 05  | [Realtime R0](./05-realtime-r0.md)                 | Voice turn sequence, state machine, latency budget, failures | Draft    |
| 06  | [Language pack spec](./06-language-pack-spec.md)   | Content schema, validator rules, contribution workflow       | Draft    |
| —   | [ADRs](./adr/README.md)                            | 9 accepted decisions with alternatives and review triggers   | Accepted |

## Scope of Phase 1

Locked decisions from Phase 0 that these documents implement:

- One seeded language pack (English → Spanish, A1) as the reference format; architecture is
  language-agnostic and content is community-contributed. See [ADR-0008](./adr/0008-multilanguage-as-data.md).
- Voice in MVP is **R0**: push-to-talk, one-way turns. Full duplex is V1.
  See [ADR-0005](./adr/0005-livekit-webrtc-staged-realtime.md).
- Free text tutoring with **metered voice**. Usage metering ships in MVP.
  See [ADR-0009](./adr/0009-usage-metering-in-mvp.md).
- Code Apache-2.0, content CC BY-NC, CLA required. See [ADR-0006](./adr/0006-apache2-code-ccbync-content.md).

## Conventions used in these documents

- `SHOULD` / `MUST` / `MAY` follow RFC 2119.
- Field names are `snake_case` in the database, `camelCase` in JSON payloads.
- All identifiers are UUID v7 (time-ordered) unless stated otherwise.
- All timestamps are `timestamptz`, stored UTC, serialized ISO-8601.
- "MVP" = the phase defined in Phase 0; "V1"/"V2" are later.

## How to change these documents

Any change to a decision recorded in an ADR requires a new ADR that supersedes it — do not
silently edit the consequences section. Data model and API changes are edited in place while
in Draft, and require a migration note once code exists.
