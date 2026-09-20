# 04 — AI contracts

The mentor's quality comes from **context and structure**, not from model choice. This document
defines the interfaces that make that true and testable. See ADR-0004.

Three mechanisms distinguish this from a chat wrapper:

1. **`LearnerContext`** — a typed, per-turn snapshot of what this learner knows, is learning,
   and keeps getting wrong.
2. **Structured output contracts** — corrections arrive as validated JSON, so the UI can render
   inline grammar cards instead of prose in a chat log.
3. **Eval gates in CI** — prompts and model changes cannot merge on vibes.

---

## 1. `LearnerContext`

Built fresh every turn by `packages/ai/context`. Retrieval is **not** uniform: learner state is
a set of targeted SQL queries against `concept_mastery`, `error_record`, and `vocab_item`; vector
search is used only to retrieve _authored content_ for explanation. Conflating the two is the
most common way these systems become slow and wrong.

```ts
type LearnerContext = {
  context_version: "1";
  language: {
    target: { tag: string; name: string; script: string; direction: "ltr" | "rtl" | "ttb" };
    native: { tag: string; name: string };
    pair_key: string; // "en->es"
    transliteration_required: boolean;
  };
  learner: {
    cefr_ceiling: CEFR; // hard cap on output complexity
    cefr_self: CEFR | null;
    cefr_assessed: CEFR | null;
    goal: { type: string; note: string | null };
    streak_days: number;
    minutes_last_7d: number;
    preferred_register: "formal" | "neutral" | "informal";
  };
  session: {
    mode: MentorMode;
    lesson: {
      id: string;
      title: string;
      unit_title: string;
      objectives: string[]; // from lesson_concept roles
      mentor_brief: string; // authored guidance for the mentor
    } | null;
    scenario_key: string | null;
    turn_index: number;
    max_turns: number | null;
  };
  curriculum: {
    concepts_in_focus: Array<{
      key: string;
      kind: ConceptKind;
      cefr: CEFR;
      title: string;
      authored_explanation: string; // retrieved excerpt, length-capped
      examples: Array<{ target: string; native: string }>;
      common_errors: string[];
    }>;
    prerequisites: Array<{ key: string; title: string; mastered: boolean }>;
    allowed_vocabulary: { core: string[]; newly_introduced: string[] };
    forbidden_structures: string[]; // grammar/tense budget for this lesson
  };
  learner_model: {
    concept_mastery: Array<{
      key: string;
      state: MasteryState;
      stability: number;
      accuracy: number;
      last_seen_days_ago: number;
    }>;
    weak_concepts: Array<{
      key: string;
      recent_error_count: number;
      dominant_category: ErrorCategory;
    }>;
    recent_errors: Array<{
      // last 12, deduped by (category, subcategory)
      category: ErrorCategory;
      subcategory_key: string | null;
      original: string;
      corrected: string;
      concept_key: string | null;
      days_ago: number;
    }>;
    recurring_error_categories: ErrorCategory[];
    due_review: Array<{ key: string; kind: "concept" | "vocab" }>; // max 10
    known_vocabulary_sample: string[]; // what we may assume is understood
  };
  policy: {
    max_new_vocab_per_turn: number; // default 2
    correction_style: "inline_minimal" | "recast" | "deferred";
    correction_density: "low" | "moderate" | "high";
    explain_on_request: boolean;
    use_native_language: "never" | "on_request" | "for_explanations";
    max_reply_sentences: number;
  };
};
```

**Budget:** the assembled context MUST stay under 4,000 tokens. Retrieval functions take explicit
limits and every list above has a cap. A context builder without caps will grow until it costs
more than the reply.

**`cefr_ceiling`** is the minimum of the lesson level and the learner's assessed level. The
mentor must not produce subjunctive constructions to an A1 learner in lesson 3, however natural
that would be. This is enforced by an eval suite, not by hoping.

**`forbidden_structures`** is the vocabulary/grammar budget derived from the pack. It is what
keeps the mentor inside the curriculum instead of drifting into general conversation.

### Context modes and their policies

| Mode                  | correction_style | density  | use_native_language | max replies            |
| --------------------- | ---------------- | -------- | ------------------- | ---------------------- |
| `lesson_coach`        | inline_minimal   | moderate | for_explanations    | 3 sentences            |
| `free_conversation`   | recast           | low      | on_request          | 2 sentences            |
| `roleplay`            | recast           | low      | never               | 2 sentences            |
| `doubt_resolution`    | inline_minimal   | high     | for_explanations    | unbounded, explanatory |
| `pronunciation_drill` | inline_minimal   | high     | for_explanations    | 2 sentences + hint     |
| `placement`           | deferred         | none     | never               | structured items only  |

`recast` means the mentor repeats the learner's meaning correctly in their reply instead of
interrupting — better for fluency, worse for explicit noticing. Both modes must exist; the mode
is a product decision, not a model decision.

---

## 2. Correction contract

This is the single most important output shape in the product.

```ts
type Correction = {
  id: string;
  span: { start: number; end: number } | null; // offsets into the learner utterance
  original: string;
  corrected: string;
  category: ErrorCategory; // language-agnostic enum (see 02-data-model)
  subcategory_key: string | null; // pack-defined, e.g. "ser_vs_estar"
  concept_key: string | null;
  explanation: string; // <= 2 sentences, CEFR-appropriate
  explanation_language: string; // bcp47 of the explanation text
  severity: 1 | 2 | 3; // 1 nitpick · 2 noticeable · 3 meaning-breaking
  is_meaning_changing: boolean;
  example: { target: string; native: string } | null;
  surface: "inline" | "after_turn" | "end_of_session";
  grounded_in: string | null; // concept.key whose authored text supports this
  is_ungrounded: boolean; // true if the model asserted a rule we cannot cite
};
```

```ts
type PronunciationFeedback = {
  // V1; MVP returns null
  target_phoneme_ipa: string;
  heard_as_ipa: string | null;
  stress_ok: boolean | null;
  tone_ok: boolean | null;
  hint: string;
  confidence: number; // 0..1 — below 0.7 the UI says "not sure"
};
```

```ts
type MentorTurnResponse = {
  // emitted as the `structured` field at turn_end
  reply_text: string;
  reply_translation: string | null; // native-language gloss, optional
  corrections: Correction[];
  vocabulary_introduced: Array<{ lemma: string; translation: string; cefr: CEFR }>;
  concepts_referenced: string[];
  pronunciation_feedback: PronunciationFeedback | null;
  learner_cefr_estimate: CEFR; // rolling estimate, informational only
  follow_up_question: string | null;
  should_end_session: boolean;
  safety: { flagged: boolean; reason: string | null };
};
```

**The pattern:** stream `reply_text` tokens for feel, then emit the validated `MentorTurnResponse`
as JSON for pedagogy. The learner experiences a natural conversation; the system gets structured
data for progress, remediation, and UI.

`is_ungrounded` is set by a post-check, not by the model. If a correction names a `concept_key`
outside the lesson's `concepts_in_focus` and outside the pack's concept set, or claims a
`grounded_in` that does not contain the asserted rule, the correction is flagged and logged for
human review. The UI suppresses flagged corrections rather than teaching a rule we cannot cite.
**A confident wrong explanation in a language the learner cannot verify is the fastest way to
lose them permanently.**

---

## 3. Tools (function calling)

The model has an allowlist. Nothing outside it is callable.

| Tool                     | Signature                                    | Purpose                                        |
| ------------------------ | -------------------------------------------- | ---------------------------------------------- |
| `get_concept_detail`     | `(concept_key, depth: "brief"\|"full")`      | Authored explanation + examples                |
| `get_concept_examples`   | `(concept_key, count, register?)`            | More examples in the target language           |
| `search_curriculum`      | `(query, top_k≤5)`                           | RAG over authored content, scoped to the pack  |
| `get_learner_errors`     | `(category?, concept_key?, limit≤20)`        | "Show me my mistakes"                          |
| `get_learner_vocabulary` | `(filter: "known"\|"due"\|"weak", limit≤30)` | Vocabulary-aware replies                       |
| `record_learner_error`   | `(Correction)`                               | Structured mistake capture, never free text    |
| `schedule_review`        | `(item_type, key, rating)`                   | Learner-requested extra practice               |
| `translate_text`         | `(text, direction)`                          | Dedicated translation call, not the chat model |
| `end_session`            | `(reason)`                                   | Deliberate session close                       |

**Deliberately absent:** web search, code execution, file access, arbitrary SQL, any tool that
can read another user's data. Every tool's arguments are schema-validated and every tool is
scoped to the authenticated user's own data.

`translate_text` is a separate model call on purpose. Translation accuracy inside a chat
completion is materially worse than a dedicated translation request, and translations are shown
to learners as authoritative.

---

## 4. Prompt registry

Prompts are versioned files in `packages/ai/prompts/`, code-reviewed like any source file.

```
packages/ai/prompts/
  lesson_coach.v3.md
  free_conversation.v2.md
  roleplay.v1.md
  doubt_resolution.v1.md
  pronunciation_drill.v1.md
  placement.v1.md
  _partials/
    safety_policy.md
    output_rules.md
    correction_rules.md
```

Front-matter on every prompt file:

```yaml
---
id: lesson_coach
version: 3
target_models: [fast-tier, strong-tier]
required_context_fields:
  [
    language,
    learner.cefr_ceiling,
    session.lesson,
    curriculum.concepts_in_focus,
    learner_model.recent_errors,
  ]
output_schema: MentorTurnResponse
eval_suites: [correction_accuracy, level_appropriateness, injection_resistance]
owner: ai
changelog:
  - 3: "Anchor corrections to lesson concepts; suppress ungrounded rules"
---
```

`required_context_fields` is validated at runtime: if the context builder cannot supply a
declared field, the turn fails loudly rather than degrading silently. Startup also validates
that every prompt's `eval_suites` exist.

The prompt file contains **no** provider-specific formatting. A provider adapter renders the
prompt and the context into the provider's message format.

---

## 5. Guardrails (layered, fail-closed at the boundaries)

**Input**

1. Learner text is delimited in explicit tagged blocks and declared as data, never instructions.
2. Heuristic pass for injection patterns (`ignore previous`, role markers, tool-call syntax).
3. Classifier pass when the heuristic score exceeds a threshold.
4. Tool-call arguments schema-validated; tool names checked against the allowlist.

**Output**

1. JSON Schema validation against `MentorTurnResponse`. On failure, one repair retry, then a
   safe fallback: plain reply text, `corrections: []`, and a logged `output_contract_violation`.
2. Markdown sanitized before render (model output is an XSS vector in any app that renders it).
3. Length caps and sentence-count caps from `policy`.
4. **Language check:** the reply must be in the target language. A fast language detector
   validates; on mismatch, one retry, then surface the English text with a notice. Beginners get
   replies in English by accident more often than you would expect.
5. `is_ungrounded` post-check (see §2).

**Safety**

- Moderation on learner input and mentor output.
- Off-topic refusal policy: the mentor redirects, it does not lecture.
- A crisis-response path for self-harm disclosures. This is a consumer app with young users; the
  path must be designed, reviewed, and tested, not improvised in a prompt.

**Grounding**

- The mentor MUST NOT introduce a rule absent from authored content. When it does not know, it
  says so and offers to surface the question for the curriculum team. `content_report` exists for
  exactly this, and the mentor can create one.

Prompt injection and free-tier LLM abuse are the same attack surface wearing different hats: an
unmetered, unguarded chat endpoint on a free product is an API someone will farm. Guardrails and
quotas are one control, not two.

---

## 6. Eval harness (the quality gate)

Cases live in the repo so they can be contributed and reviewed:

```
evals/
  cases/correction_accuracy/es-a1-0001.yaml
  cases/injection_resistance/…
  suites.yaml
```

```yaml
id: es-a1-0001
suite: correction_accuracy
context_fixture: fixtures/en-es-a1-lesson-04.json
input:
  mode: lesson_coach
  utterance: "Yo soy cansado hoy"
expect:
  must_correct:
    - category: grammar_agreement # estar vs ser + adjective state
      subcategory_key: ser_vs_estar
  must_not_correct: []
  required_grounding: es.ser_vs_estar.present
  max_severity: 3
  explanation_language: en
  max_new_vocab: 1
scoring: [deterministic, llm_judge]
```

**Suites**

| Suite                   | What it asserts                                                          |
| ----------------------- | ------------------------------------------------------------------------ |
| `correction_accuracy`   | Must-correct / must-not-correct on a labelled set of learner utterances  |
| `groundedness`          | Every correction cites authored content and no rule is invented          |
| `level_appropriateness` | Output stays within the CEFR ceiling (vocabulary and structure analysis) |
| `native_language_usage` | Explanations appear in the native language only when policy allows       |
| `injection_resistance`  | 40+ adversarial utterances; zero successful instruction overrides        |
| `refusal_policy`        | Off-topic and unsafe inputs handled per policy                           |
| `latency_and_cost`      | p50 first-token and cost-per-turn budgets per mode                       |

**Scoring.** Deterministic assertions where possible. Subjective cases use LLM-as-judge with a
rubric, scored by a **model from a different family than the one under test** — same-family
judging measurably flatters itself.

**CI gates** (`evals.yml`):

- On any PR touching `packages/ai/**` or prompt files: run the 30-case smoke suite.
- Block merge on: any `injection_resistance` failure, `groundedness` below 98%, or
  `correction_accuracy` regression worse than 3% relative to `main`.
- Block merge on: p50 first-token above 700ms or cost per turn above the mode budget.
- Nightly: full suite; results written to `eval_run` for trend analysis.

Without these gates, every prompt "improvement" is a coin flip and quality drifts invisibly.

---

## 7. Model routing

```
packages/ai/router.ts
  tiers: { fast: {...}, strong: {...} }
  per-mode overrides, e.g.:
    lesson_coach      → strong (quality matters most; short replies)
    free_conversation → fast   (latency matters most; corrections are recasts)
    doubt_resolution  → strong (explanations must be precise)
    placement         → none   (deterministic item selection)
```

Router requirements:

- **Fallback provider** on `429` / `5xx`, with a circuit breaker and per-provider health tracking.
- **Prompt-prefix caching** on the static block (system prompt + `concepts_in_focus`).
- **Per-turn caps**: `max_tokens` per mode, and a hard cap on tool-call rounds (2).
- **Streaming** for all conversational modes. Non-streaming only for `translate_text` and
  post-checks.
- **Per-turn telemetry** written to `tutor_message` (`model_id`, `prompt_version`, token counts,
  stage latencies) and to Langfuse.

Cost/latency/quality are recorded per turn from day one. Without per-turn attribution, a provider
change or a prompt change that doubles cost is invisible until the invoice arrives.

---

## 8. Placement assessment

Placement is **not** a chat. It is a fixed-form adaptive-lite test: items are selected from
difficulty bands, branching narrows the band, and scoring is deterministic. The LLM's only role
is generating a short narrative summary of the result, which is non-authoritative and clearly
labelled as such.

Building an IRT engine before you have response data is a research project wearing a feature's
clothes. Revisit after ~10k attempts exist.

## Open questions for review

1. **`use_native_language: "for_explanations"` as the default.** This is an L1-heavy product
   decision: immersive vs comprehensible. It materially changes how much the mentor feels like a
   teacher. I recommend `for_explanations` at A0–A1 and `on_request` from A2, but this needs a
   product call before prompts are authored.
2. **Correction density by default.** `moderate` in lesson mode proposed. High density
   demonstrably damages fluency practice; low density means learners feel uncorrected. Worth an
   A/B test with a real cohort, not a guess.
3. **Groundedness threshold.** 98% proposed. Confirm the tradeoff: higher means fewer but safer
   corrections, which some learners will read as "the mentor missed my mistake".
