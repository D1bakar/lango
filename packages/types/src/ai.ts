// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";
import { cefrLevelSchema, scriptSchema, textDirectionSchema, bcp47TagSchema } from "./language";
import { conceptKeySchema, conceptKindSchema, registerSchema } from "./curriculum";
import { errorCategorySchema, errorSeveritySchema, masteryStateSchema } from "./learner";
import { uuidSchema } from "./primitives";

export const MENTOR_MODES = [
  "lesson_coach",
  "free_conversation",
  "roleplay",
  "doubt_resolution",
  "pronunciation_drill",
  "placement",
] as const;
export const mentorModeSchema = z.enum(MENTOR_MODES);
export type MentorMode = z.infer<typeof mentorModeSchema>;

/**
 * A single structured correction.
 *
 * This is the most important output shape in the product. Prose streams for
 * feel; this object is what makes inline grammar cards, weakness tracking, and
 * remediation possible. If `is_ungrounded` is true the UI suppresses the
 * correction rather than teaching a rule we cannot cite.
 */
export const correctionSchema = z.object({
  id: z.string().min(1),
  /** Offsets into the learner's utterance, when the error is locatable. */
  span: z
    .object({
      start: z.number().int().min(0),
      end: z.number().int().min(0),
    })
    .nullable(),
  original: z.string(),
  corrected: z.string().min(1),
  category: errorCategorySchema,
  subcategory_key: z.string().min(1).nullable(),
  concept_key: conceptKeySchema.nullable(),
  /** At most two sentences, written at the learner's level. */
  explanation: z.string().min(1),
  explanation_language: bcp47TagSchema,
  severity: errorSeveritySchema,
  is_meaning_changing: z.boolean(),
  example: z.object({ target: z.string().min(1), native: z.string().min(1) }).nullable(),
  surface: z.enum(["inline", "after_turn", "end_of_session"]),
  /** The authored concept whose text supports this correction, if any. */
  grounded_in: conceptKeySchema.nullable(),
  /** Set by a post-check, not by the model. */
  is_ungrounded: z.boolean(),
});
export type Correction = z.infer<typeof correctionSchema>;

/**
 * Pronunciation feedback. Not produced in the MVP: without phoneme scoring,
 * pronunciation errors are inferred from the transcript only. `confidence`
 * exists so the UI can say "not sure" instead of asserting wrongly, which is
 * how learners stop trusting the feature.
 */
export const pronunciationFeedbackSchema = z.object({
  target_phoneme_ipa: z.string().min(1),
  heard_as_ipa: z.string().min(1).nullable(),
  stress_ok: z.boolean().nullable(),
  tone_ok: z.boolean().nullable(),
  hint: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type PronunciationFeedback = z.infer<typeof pronunciationFeedbackSchema>;

/** Emitted as the `structured` field of the `turn_end` stream event. */
export const mentorTurnResponseSchema = z.object({
  reply_text: z.string().min(1),
  reply_translation: z.string().min(1).nullable(),
  corrections: z.array(correctionSchema),
  vocabulary_introduced: z.array(
    z.object({
      lemma: z.string().min(1),
      translation: z.string().min(1),
      cefr: cefrLevelSchema,
    }),
  ),
  concepts_referenced: z.array(conceptKeySchema),
  pronunciation_feedback: pronunciationFeedbackSchema.nullable(),
  /** Rolling estimate. Informational only: never used to gate content access. */
  learner_cefr_estimate: cefrLevelSchema,
  follow_up_question: z.string().min(1).nullable(),
  should_end_session: z.boolean(),
  safety: z.object({
    flagged: z.boolean(),
    reason: z.string().nullable(),
  }),
});
export type MentorTurnResponse = z.infer<typeof mentorTurnResponseSchema>;

// ---------------------------------------------------------------------------
// LearnerContext
// ---------------------------------------------------------------------------

/**
 * Per-turn snapshot of what this learner knows, is learning, and keeps getting
 * wrong. Assembled from targeted SQL over `concept_mastery`, `error_record`, and
 * `vocab_item` — NOT from vector search. Retrieved content is a separate
 * mechanism and only serves explanation grounding.
 *
 * The assembled context MUST stay under 4,000 tokens. Every list below is
 * capped; a context builder without caps grows until it costs more than the reply.
 */
export const learnerContextSchema = z.object({
  context_version: z.literal("1"),
  language: z.object({
    target: z.object({
      tag: bcp47TagSchema,
      name: z.string().min(1),
      script: scriptSchema,
      direction: textDirectionSchema,
    }),
    native: z.object({ tag: bcp47TagSchema, name: z.string().min(1) }),
    pair_key: z.string().regex(/^[a-z]{2,3}->[a-z]{2,3}$/, "Shape: `en->es`."),
    transliteration_required: z.boolean(),
  }),
  learner: z.object({
    /** Hard cap on output complexity: the lower of lesson level and assessed level. */
    cefr_ceiling: cefrLevelSchema,
    cefr_self: cefrLevelSchema.nullable(),
    cefr_assessed: cefrLevelSchema.nullable(),
    goal: z.object({ type: z.string().min(1), note: z.string().nullable() }),
    streak_days: z.number().int().min(0),
    minutes_last_7d: z.number().int().min(0),
    preferred_register: registerSchema,
  }),
  session: z.object({
    mode: mentorModeSchema,
    lesson: z
      .object({
        id: uuidSchema,
        title: z.string().min(1),
        unit_title: z.string().min(1),
        objectives: z.array(z.string().min(1)),
        /** Authored guidance for the mentor about this specific lesson. */
        mentor_brief: z.string().min(1),
      })
      .nullable(),
    scenario_key: z.string().min(1).nullable(),
    turn_index: z.number().int().min(0),
    max_turns: z.number().int().min(1).nullable(),
  }),
  curriculum: z.object({
    concepts_in_focus: z.array(
      z.object({
        key: conceptKeySchema,
        kind: conceptKindSchema,
        cefr: cefrLevelSchema,
        title: z.string().min(1),
        authored_explanation: z.string().min(1),
        examples: z.array(z.object({ target: z.string().min(1), native: z.string().min(1) })),
        common_errors: z.array(z.string().min(1)),
      }),
    ),
    prerequisites: z.array(
      z.object({ key: conceptKeySchema, title: z.string().min(1), mastered: z.boolean() }),
    ),
    allowed_vocabulary: z.object({
      core: z.array(z.string().min(1)),
      newly_introduced: z.array(z.string().min(1)),
    }),
    /** Grammar and tense budget for this lesson. Keeps the mentor in the curriculum. */
    forbidden_structures: z.array(z.string().min(1)),
  }),
  learner_model: z.object({
    concept_mastery: z.array(
      z.object({
        key: conceptKeySchema,
        state: masteryStateSchema,
        stability: z.number().min(0),
        accuracy: z.number().min(0).max(1),
        last_seen_days_ago: z.number().min(0),
      }),
    ),
    weak_concepts: z.array(
      z.object({
        key: conceptKeySchema,
        recent_error_count: z.number().int().min(0),
        dominant_category: errorCategorySchema,
      }),
    ),
    /** Last 12, deduplicated by (category, subcategory_key). */
    recent_errors: z.array(
      z.object({
        category: errorCategorySchema,
        subcategory_key: z.string().min(1).nullable(),
        original: z.string(),
        corrected: z.string(),
        concept_key: conceptKeySchema.nullable(),
        days_ago: z.number().min(0),
      }),
    ),
    recurring_error_categories: z.array(errorCategorySchema),
    due_review: z.array(z.object({ key: z.string().min(1), kind: z.enum(["concept", "vocab"]) })),
    known_vocabulary_sample: z.array(z.string().min(1)),
  }),
  policy: z.object({
    /** New vocabulary the mentor may introduce in a single turn. */
    max_new_vocab_per_turn: z.number().int().min(0).max(10),
    correction_style: z.enum(["inline_minimal", "recast", "deferred"]),
    correction_density: z.enum(["low", "moderate", "high"]),
    explain_on_request: z.boolean(),
    use_native_language: z.enum(["never", "on_request", "for_explanations"]),
    max_reply_sentences: z.number().int().min(1).max(10),
  }),
});
export type LearnerContext = z.infer<typeof learnerContextSchema>;

// ---------------------------------------------------------------------------
// Tutoring stream (SSE)
// ---------------------------------------------------------------------------

export const TUTOR_STREAM_EVENTS = [
  "turn_start",
  "transcript",
  "token",
  "correction",
  "vocabulary",
  "audio_ready",
  "usage",
  "turn_end",
  "error",
] as const;
export const tutorStreamEventNameSchema = z.enum(TUTOR_STREAM_EVENTS);
export type TutorStreamEventName = z.infer<typeof tutorStreamEventNameSchema>;

/**
 * Guarantees the client may rely on:
 *  - `turn_start` is always first; `turn_end` or `error` is always last.
 *  - `token` events form the reply text in order. Render immediately.
 *  - `correction` events may arrive after the prose ends. Never block on them.
 *  - `audio_ready` may be absent. The turn is still valid as text.
 *  - `usage` is emitted even on failure, where it reports zero consumption.
 */
export const tutorStreamEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("turn_start"),
    turn_id: uuidSchema,
    model_id: z.string().min(1),
    prompt_version: z.string().min(1),
  }),
  z.object({
    event: z.literal("transcript"),
    text: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  z.object({ event: z.literal("token"), text: z.string() }),
  z.object({ event: z.literal("correction"), correction: correctionSchema }),
  z.object({
    event: z.literal("vocabulary"),
    lemma: z.string().min(1),
    translation: z.string().min(1),
    cefr: cefrLevelSchema,
  }),
  z.object({
    event: z.literal("audio_ready"),
    url: z.string().min(1),
    duration_ms: z.number().int().min(0),
    voice_id: z.string().min(1),
  }),
  z.object({
    event: z.literal("usage"),
    voice_seconds_remaining: z.number().min(0),
    tokens_in: z.number().int().min(0),
    tokens_out: z.number().int().min(0),
  }),
  z.object({
    event: z.literal("turn_end"),
    message_id: uuidSchema,
    structured: mentorTurnResponseSchema,
  }),
  z.object({
    event: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    fallback_available: z.boolean(),
  }),
]);
export type TutorStreamEvent = z.infer<typeof tutorStreamEventSchema>;
