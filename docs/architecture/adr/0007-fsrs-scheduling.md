# ADR-0007 — FSRS over SM-2 for spaced repetition scheduling

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

Revision is a core product requirement: concepts and vocabulary must resurface before they are
forgotten, and the schedule must be per-learner rather than fixed by the curriculum. Two things
need scheduling — **concepts** (grammar rules, pragmatics; bounded, curriculum-defined) and
**vocabulary** (unbounded, grows with every lesson and mentor conversation).

Anki's SM-2 (from 1987) is the default choice: simple, well understood, two parameters, easy to
implement. FSRS (Free Spaced Repetition Scheduler) is a newer alternative that models memory
with stability and difficulty and can be fitted to real review data.

The scheduling state must be stored per user per item, be cheap to query for "what is due now",
and produce a signal that the mentor's context builder can consume ("this concept is due").

## Decision

**FSRS** for both concepts and vocabulary, with `stability`, `difficulty`, `due_at`,
`last_reviewed_at`, `reps`, `lapses`, `state`, and `fsrs_version` stored on `concept_mastery` and
`vocab_item`.

Two decisions that matter as much as the algorithm choice:

1. **Every review is logged to `review_log`** as an append-only record of rating, elapsed days,
   scheduled days, and state before. This is what makes it possible to refit FSRS parameters on
   our own learners' data later. It is cheap to write now and impossible to reconstruct later.
2. **Ratings come from graded exercises wherever possible**, not from learner self-assessment.
   Self-rating ("did you know it?") is available only for vocabulary flashcards, where no
   objective answer exists. A learner cannot reliably judge their own recall, and a lesson
   exercise produces an objective signal we already have.

`fsrs_version` is stored per row so a parameter change can be rolled out progressively and
compared, rather than applied globally and blindly.

## Consequences

**Positive**

- Better retention for the same study time than SM-2 in published comparisons, which is the
  entire point of the feature — and it compounds across every learner and every session.
- Difficulty is modelled per item rather than derived from a fixed ease factor, so an item that
  is genuinely hard for this learner stays scheduled differently instead of being flattened.
- `review_log` gives us our own dataset to tune against. After ~10k reviews we can fit parameters
  to real learners rather than using defaults tuned on other people's data.
- Deterministic, testable pure functions in `packages/core`. No external service, no runtime cost,
  no LLM calls in the scheduling path.
- Stability values give the progress UI a principled "how well do I know this" number instead of
  a fake percentage.

**Negative**

- More state and more logic than SM-2: four rating levels, state transitions, and a version field
  to manage. SM-2 is two formulas and a card.
- Default FSRS parameters are not automatically correct for language learning, which differs from
  flashcard recall — recognizing a grammar rule in conversation is not the same as recalling a
  vocabulary item. Expect to fit and adjust; do not assume defaults are right.
- Requires `review_log` discipline. Without it, the algorithm is a black box we cannot improve.
- Ratings are lossy for language learning: `again/hard/good/easy` is a coarse summary of "the
  learner produced a correct sentence with a slight agreement error".
- If we later find concept-level scheduling poorly suited to grammar (which is not really a
  memorization item), we will have built a scheduler around the wrong unit of knowledge. This is
  the honest risk and it is why `review_log` exists.

## Alternatives considered

- **SM-2.** Rejected as the default because FSRS is strictly better with real data and the extra
  implementation cost is a few hundred lines of pure functions. SM-2 remains the fallback if FSRS
  proves unpredictable in practice.
- **Fixed curriculum-driven review.** Rejected: ignores individual forgetting rates, which is the
  whole reason spaced repetition works.
- **Leitner boxes.** Rejected: too coarse; no notion of difficulty or stability.
- **No scheduling; review items chosen randomly from completed lessons.** Rejected as a
  product-quality failure, and it removes one of the few retention mechanisms language apps have
  that genuinely works.
- **Third-party SRS service.** Rejected: an external dependency for a few hundred lines of pure
  logic, with learner progress locked behind an API.
- **LLM-driven scheduling ("decide what to review today").** Rejected: non-deterministic,
  unmeasurable, more expensive, and worse than a fitted memory model at a task that has an
  established quantitative answer.

## Review trigger

Revisit if: fitted FSRS parameters show no retention advantage over SM-2 on our own data, if
concept-level scheduling proves pedagogically wrong for grammar (then restrict FSRS to vocabulary
and drive concept practice from error frequency instead), or if `review_log` volume makes the
scheduling query expensive — which the `concept_mastery (user_id, target_language_id, due_at)`
index is designed to prevent.
