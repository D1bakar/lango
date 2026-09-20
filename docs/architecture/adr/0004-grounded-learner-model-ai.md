# ADR-0004 — Grounded learner-model AI with structured outputs and eval gates

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

The product's central claim is that an AI mentor is a meaningfully better learning experience
than question-and-answer lesson apps. If the mentor is a thin prompt over a general chat model, it
is neither differentiated nor reliable: it will hallucinate grammar rules, ignore what the learner
has already learned, drift outside the current lesson, and produce prose that the UI cannot turn
into actionable feedback. The failure mode is severe because learners cannot verify correctness in
a language they do not yet speak. A confidently wrong explanation teaches a wrong habit and
destroys trust permanently.

At the same time, the moat must be defensible. Any competitor can call the same model.

## Decision

Build the mentor as a **grounded system with a persistent learner model**, not as a chat
completion. Four mechanisms, all defined in `04-ai-contracts.md`:

1. **`LearnerContext`** — a typed, capped (<4,000 token) per-turn snapshot assembled from
   targeted SQL over `concept_mastery`, `error_record`, `vocab_item`, and the current lesson.
   Learner-state retrieval is explicitly **relational, not RAG**: no vector search on the
   critical path.
2. **Content grounding** — the mentor may only ground explanations in authored, human-reviewed
   `concept.explanation_md` and `content_example` rows. A post-check flags corrections that
   assert a rule we cannot cite (`is_ungrounded`), and flagged corrections are suppressed from
   the UI and logged for review rather than shown to the learner.
3. **Structured output contracts** — corrections are returned as validated `Correction` objects
   with span, category, severity, and concept key. Prose streams for feel; the validated
   `MentorTurnResponse` is emitted as JSON for pedagogy. Schema violations get one repair retry,
   then a safe fallback.
4. **Eval gates in CI** — a labelled corpus of learner utterances with deterministically scored
   suites (`correction_accuracy`, `groundedness`, `level_appropriateness`, `injection_resistance`,
   `latency_and_cost`). Merges are blocked on injection failures, groundedness below 98%, or a
   3% relative regression in correction accuracy.

Prompts are versioned files in the repo with front-matter declaring required context fields,
output schema, and eval suites. Model access goes through a router with per-mode tiers, provider
fallback, prompt-prefix caching, and per-turn telemetry written to `tutor_message`.

## Consequences

**Positive**

- **Quality becomes measurable and regressions become visible.** Prompt changes are experiments
  with a gate, not opinions. This is the difference between a product that improves for a year
  and one that silently degrades.
- Replacing the underlying model becomes a routing change validated by evals, not a rewrite. This
  matters because model prices and capabilities move faster than our product does.
- Per-turn cost and latency attribution exists from day one, so unit economics are observable
  rather than discovered on an invoice.
- The learner model is genuinely hard to copy: it accumulates error taxonomy and mastery data
  that a competitor starting today does not have. This, plus authored content, is the moat.
- Structured corrections enable UI that feels like a teacher — inline grammar cards, weakness
  tracking, remediation — which a chat log cannot support.
- `is_ungrounded` gives us a feedback loop from model output back to the content team, so
  content gaps surface as data rather than as learner complaints.

**Negative**

- **Significantly more engineering than a chat prompt.** A context builder with caps, a prompt
  registry, a router, schema validation, post-checks, and an eval harness are real subsystems
  with real maintenance cost.
- **Eval maintenance is ongoing.** The corpus must grow with the product or it stops catching
  anything. An unmaintained eval suite is worse than none, because it produces false confidence.
- Grounding constrains the mentor: it will sometimes refuse to answer things it could plausibly
  get right, which can read as evasiveness. Mitigated by surfacing the question to the content
  team instead of dead-ending.
- Latency increases relative to a bare model call because of context assembly and post-checks,
  which is why the context build has a 40ms p50 budget and the RAG path has a hard 400ms timeout
  with a documented degradation to `explanation_md` only.
- Relational learner-state retrieval means context quality is coupled to schema design. A poorly
  indexed query becomes a latency incident.

## Alternatives considered

- **Direct chat completion with a rich system prompt.** Rejected: no structured corrections, no
  progress integration, no eval surface, and unknown cost per turn. This is the specific outcome
  the product must not be.
- **Full RAG over everything, including learner state.** Rejected: embedding a learner's mastery
  state to retrieve it is strictly slower and less accurate than a SQL query that reads it
  directly. Vector search belongs on content, not on structured state.
- **Fine-tuning a model per language pair.** Rejected for now: high cost, slow iteration, opaque
  failures, and it does not address grounding. Revisit only when the instruction-tuned baseline
  plateaus on the eval suites.
- **Vendor speech-to-speech end to end.** Rejected as the architecture (see ADR-0005), because it
  gives us no control over the pedagogical layer — the part that is actually the product.
- **LLM-generated curriculum content.** Rejected: explanations shown to learners must be
  authored and reviewed. See ADR-0008.
- **No eval harness, manual spot-checking.** Rejected: quality drift is invisible without
  measurement, and manual checking does not scale past one engineer.

## Review trigger

Revisit if base models become reliably grounded on their own (in which case post-checks can
relax), if eval maintenance cost exceeds its defect-detection value, or if grounding constraints
measurably suppress useful teaching rather than preventing wrong teaching.
