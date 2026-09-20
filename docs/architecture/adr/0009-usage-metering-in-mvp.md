# ADR-0009 — Usage metering and voice quotas ship in the MVP

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

The product is free to use, and its differentiator is real-time AI voice. Voice has a **real
marginal cost per minute**, paid in cash to STT, LLM, and TTS providers. That cost is not amortized
like infrastructure; it scales linearly with engagement. Rough order of magnitude for a 10-minute
voice session, before prompt caching and TTS reuse:

| Component                                | Lean                  | Premium                     |
| ---------------------------------------- | --------------------- | --------------------------- |
| STT                                      | ~$0.06                | ~$0.06                      |
| LLM (10 turns, cached prefix, fast tier) | ~$0.02                | ~$0.06                      |
| TTS                                      | ~$0.10 (cheap neural) | ~$1.50 (premium expressive) |
| **Per 10-minute session**                | **~$0.18**            | **~$1.62**                  |

At 10,000 sessions per day that is roughly $1,800–$16,000 per day in variable cost. The product's
stated stance is free text with metered voice and a paid tier later. That stance is unenforceable
without measurement, and unmeasurable without instrumentation built into the request path.

The failure mode of adding metering later is specific and expensive: quotas and cost controls
cannot be applied retroactively to data that was never collected, and a free product that has
already trained users to expect unlimited voice will experience quota introduction as a
takeaway. Retrofitting metering also means threading accounting through every AI call site after
they already exist.

## Decision

**Usage metering, quota enforcement, and cost attribution are MVP scope, on the same footing as
auth and the lesson player.**

1. **Append-only `usage_ledger`** recording every metered event (voice seconds, STT seconds, TTS
   characters, LLM input/output tokens) with provider, model, quantity, unit cost, and the
   `tutor_session_id` that caused it. This is the auditable cost truth.
2. **Fast `usage_counter` read model** (Redis-backed with a Postgres fallback) serving
   `GET /v1/usage/current` and the pre-flight quota check.
3. **Two-phase enforcement.** A pre-flight token-bucket check rejects with `402
quota_exhausted` before the expensive work happens; a post-turn commit records the _actual_
   measured quantity. Pre-flight prevents overspend; post-commit keeps the numbers true. A hard
   monthly cap exists so a runaway bug becomes a bounded incident rather than a billing event.
4. **Cost attribution per turn**, written to `tutor_message` alongside token counts and stage
   latencies, and reported per day/model/provider through `/v1/admin/usage/cost`.
5. **Free/paid boundary is structural, not cosmetic.** Free tier includes generous text tutoring
   and a daily voice allowance. Unlimited voice is the paid upgrade. Text mode remains available
   after the voice quota is exhausted, so the product degrades instead of stopping.
6. **Never charge for undelivered value.** Failed turns write ledger rows with `quantity = 0`. The
   learner is not charged; the cost analysis stays honest.
7. **Cost controls that reduce unit cost, not just visibility:** prompt-prefix caching, TTS
   pre-generation at pack publish, `audio_asset.text_hash` caching for repeated utterances, model
   tiering per mode, per-turn token caps, and a server-enforced maximum utterance length.

## Consequences

**Positive**

- The business model is enforceable on day one. We can launch free without risking insolvency,
  which is not true of any "add billing later" plan for a voice product.
- Unit economics become observable in the first week: cost per session, per active learner, per
  mode. Decisions about pricing, TTS provider, and session limits are made from data.
- Provider migration can be evaluated on measured cost per minute, which is the only way to make
  that decision rationally given how often TTS and STT pricing changes.
- Quota enforcement is a single middleware plus a counter, not a distributed accounting problem
  spread across call sites.
- Pricing the paid tier later requires no new instrumentation — only a plan lookup.
- The ledger is a natural fraud and abuse detection surface (a user with 40 sessions in an hour is
  visible in data we already collect).

**Negative**

- **Real engineering in the MVP that is invisible to users.** Roughly 2–3 engineer-weeks spent on
  middling-thorough observability rather than learning outcomes. This is the cost we accept.
- Every AI call site must remember to record usage. Mitigation: metering lives inside the
  `packages/ai` provider adapters and the tutor service, not at call sites, and a missing
  `usage_ledger` row is testable.
- Two counters (`ledger` and `counter`) can disagree. Mitigated by the ledger being authoritative,
  a nightly reconciliation job, and a fail-closed policy when Redis is unavailable.
- A visible quota changes the product's tone. Free limits must be framed as "your free voice
  practice for today" rather than a denial, or the experience reads as bait-and-switch.
- Metering adds latency to the hot path (one Redis increment and, on a miss, a Postgres read).
  Kept off the LLM critical path and measured in the R0 latency budget.
- `usage_ledger` grows with every AI interaction forever and will need partitioning or archival
  within a year.

## Alternatives considered

- **Add metering in V1 or V2.** Rejected: this is the decision that determines whether a free
  voice product is solvent. You cannot meter history you never recorded, and introducing limits
  after users have formed expectations is a worse experience than setting them at launch.
- **Visible-only metering, unlimited voice.** Rejected: this is a donation, not a business model.
  It makes the cost problem legible without making it solvable.
- **Purely client-side counting.** Rejected: trivially bypassed, and it cannot attribute real
  provider cost.
- **Provider dashboards as the source of truth.** Rejected: aggregated across all users, delayed,
  not attributable to a learner, and useless for per-user quota enforcement.
- **Cap sessions by count instead of measured seconds.** Rejected: a 12-minute session and a
  45-second session would cost the same, which is wrong in both directions.
- **Charge for failed turns.** Rejected: it is the cheap-correct choice to absorb the cost, and
  being charged for the app's own failure is the single most trust-destroying billing behaviour.
- **Cache aggressively instead of metering.** Rejected as an either/or: caching and
  pre-generation are adopted too (they lower the floor), but they reduce cost, they do not bound
  it.

## Review trigger

Never as a matter of architecture — this control is cost-existential. Revisit the specific
thresholds when we have 30 days of real per-session cost data, when the paid tier is priced, or
if measured cost per session falls far enough that the daily free voice allowance can be raised
(as a growth lever, deliberately, not by drift).
