// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";
import { cefrLevelSchema } from "./language";
import { uuidSchema } from "./primitives";

export const CONTENT_STATUSES = ["draft", "in_review", "published", "deprecated"] as const;
export const contentStatusSchema = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

/**
 * The atomic teachable unit. Concepts are what a learner masters, what decays,
 * and what the mentor reasons about.
 */
export const CONCEPT_KINDS = [
  "grammar",
  "vocab",
  "pronunciation",
  "pragmatics",
  "orthography",
  "listening",
] as const;
export const conceptKindSchema = z.enum(CONCEPT_KINDS);
export type ConceptKind = z.infer<typeof conceptKindSchema>;

/** How a lesson uses a concept. Ordering across lessons is validator-enforced. */
export const CONCEPT_ROLES = ["introduce", "practise", "assess", "reinforce"] as const;
export const conceptRoleSchema = z.enum(CONCEPT_ROLES);
export type ConceptRole = z.infer<typeof conceptRoleSchema>;

export const PREREQUISITE_STRENGTHS = ["hard", "soft"] as const;
export const prerequisiteStrengthSchema = z.enum(PREREQUISITE_STRENGTHS);
export type PrerequisiteStrength = z.infer<typeof prerequisiteStrengthSchema>;

export const LESSON_TYPES = [
  "concept_intro",
  "practice",
  "review",
  "assessment",
  "conversation",
] as const;
export const lessonTypeSchema = z.enum(LESSON_TYPES);
export type LessonType = z.infer<typeof lessonTypeSchema>;

/** Stable concept identifier, e.g. `es.ser_vs_estar.present`. */
export const conceptKeySchema = z
  .string()
  .regex(
    /^[a-z]{2,3}\.[a-z0-9_]+(\.[a-z0-9_]+)*$/,
    "Concept keys look like `es.ser_vs_estar.present`: a language prefix followed by dot-separated segments.",
  );
export type ConceptKey = z.infer<typeof conceptKeySchema>;

export const registerSchema = z.enum(["formal", "neutral", "informal"]);
export type Register = z.infer<typeof registerSchema>;

/** Authored, human-reviewed teaching content. The mentor may only cite this. */
export const conceptSchema = z.object({
  id: uuidSchema,
  key: conceptKeySchema,
  kind: conceptKindSchema,
  title: z.string().min(1),
  summary_short: z.string().min(1).max(160),
  explanation_md: z.string().min(1),
  cefr_level: cefrLevelSchema,
  pronunciation_ipa: z.string().min(1).nullable(),
  version: z.number().int().min(1),
  status: contentStatusSchema,
});
export type Concept = z.infer<typeof conceptSchema>;

export const contentExampleSchema = z.object({
  target_text: z.string().min(1),
  native_text: z.string().min(1),
  transliteration: z.string().min(1).nullable(),
  register: registerSchema,
});
export type ContentExample = z.infer<typeof contentExampleSchema>;

// ---------------------------------------------------------------------------
// Exercise types
// ---------------------------------------------------------------------------

export const EXERCISE_TYPES = [
  "mcq",
  "multi_select",
  "translate_to_target",
  "translate_to_native",
  "reorder_tokens",
  "fill_blank",
  "type_answer",
  "listen_select",
  "listen_type",
  "speak_repeat",
  "speak_free",
  "match_pairs",
] as const;
export const exerciseTypeSchema = z.enum(EXERCISE_TYPES);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

/**
 * Payload and answer shapes are implemented below for the types the MVP lesson
 * player uses. The remaining declared types (translate_to_native, listen_select,
 * listen_type, speak_free, match_pairs) get their schemas in Phase 4 with the
 * lesson engine that grades them.
 *
 * `answer_spec` is NEVER serialized to a client. Grading is server-side only.
 */

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const mcqExerciseSchema = z.object({
  type: z.literal("mcq"),
  payload: z.object({ options: z.array(optionSchema).min(2) }),
  answer_spec: z.object({ correct: z.array(z.string().min(1)).length(1) }),
});

const multiSelectExerciseSchema = z.object({
  type: z.literal("multi_select"),
  payload: z.object({ options: z.array(optionSchema).min(2) }),
  answer_spec: z.object({ correct: z.array(z.string().min(1)).min(1) }),
});

const typeAnswerExerciseSchema = z.object({
  type: z.literal("type_answer"),
  payload: z.object({
    placeholder: z.string().optional(),
    max_length: z.number().int().min(1).max(500).default(120),
  }),
  answer_spec: z.object({
    accepted_answers: z.array(z.string().min(1)).min(1),
    alternatives: z.array(z.string().min(1)).default([]),
  }),
});

const translateToTargetExerciseSchema = z.object({
  type: z.literal("translate_to_target"),
  payload: z.object({ source_text: z.string().min(1), hint: z.string().optional() }),
  answer_spec: z.object({
    accepted_answers: z.array(z.string().min(1)).min(1),
    alternatives: z.array(z.string().min(1)).default([]),
  }),
});

const reorderTokensExerciseSchema = z.object({
  type: z.literal("reorder_tokens"),
  payload: z.object({ tokens: z.array(z.string().min(1)).min(2) }),
  answer_spec: z.object({
    correct_order: z.array(z.number().int().min(0)).min(2),
  }),
});

const fillBlankExerciseSchema = z.object({
  type: z.literal("fill_blank"),
  payload: z.object({
    text_with_blanks: z.array(z.string()).min(1),
    blanks: z.array(z.number().int().min(0)).min(1),
  }),
  answer_spec: z.object({
    /** One group of acceptable answers per blank. */
    answers: z.array(z.array(z.string().min(1)).min(1)).min(1),
  }),
});

const speakRepeatExerciseSchema = z.object({
  type: z.literal("speak_repeat"),
  payload: z.object({
    target_text: z.string().min(1),
    transliteration: z.string().min(1).nullable(),
  }),
  answer_spec: z.object({
    expected_transcript: z.string().min(1),
    /**
     * Below this transcript confidence the attempt is surfaced as
     * "please repeat", never recorded as a mistake. ASR failure and learner
     * failure are different events.
     */
    min_confidence: z.number().min(0).max(1).default(0.6),
  }),
});

export const exerciseSchema = z.discriminatedUnion("type", [
  mcqExerciseSchema,
  multiSelectExerciseSchema,
  typeAnswerExerciseSchema,
  translateToTargetExerciseSchema,
  reorderTokensExerciseSchema,
  fillBlankExerciseSchema,
  speakRepeatExerciseSchema,
]);
export type Exercise = z.infer<typeof exerciseSchema>;

/**
 * A lesson item as delivered to the client. Note the absence of `answer_spec`
 * and `explanation_md`: the answer key never leaves the server, and the
 * explanation is returned only with the graded attempt.
 */
export const lessonItemSchema = z.object({
  exercise_id: uuidSchema,
  exercise_revision: z.number().int().min(1),
  order_index: z.number().int().min(0),
  exercise_type: exerciseTypeSchema,
  prompt_md: z.string().min(1),
  payload: z.unknown(),
  prompt_audio_url: z.string().min(1).nullable(),
  difficulty: z.number().int().min(1).max(5),
});
export type LessonItem = z.infer<typeof lessonItemSchema>;

export const lessonManifestSchema = z.object({
  lesson_id: uuidSchema,
  title: z.string().min(1),
  lesson_type: lessonTypeSchema,
  estimated_minutes: z.number().int().min(1),
  items: z.array(lessonItemSchema),
});
export type LessonManifest = z.infer<typeof lessonManifestSchema>;
