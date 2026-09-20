// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";
import { bcp47TagSchema, cefrLevelSchema } from "./language";
import { conceptKeySchema } from "./curriculum";
import { isoDateSchema, isoDateTimeSchema, uuidSchema } from "./primitives";

/** FSRS scheduling state for a concept or vocabulary item. */
export const MASTERY_STATES = ["new", "learning", "review", "relearning", "mastered"] as const;
export const masteryStateSchema = z.enum(MASTERY_STATES);
export type MasteryState = z.infer<typeof masteryStateSchema>;

/**
 * Error taxonomy.
 *
 * The top level is deliberately language-agnostic so that cross-language
 * analytics and the mentor's "your recurring weakness is agreement" reasoning
 * work for every language, including ones we have not launched. Language-specific
 * precision lives in `subcategory_key`, which each pack defines.
 */
export const ERROR_CATEGORIES = [
  "grammar_agreement",
  "grammar_tense",
  "grammar_aspect",
  "grammar_mood",
  "grammar_word_order",
  "grammar_preposition",
  "grammar_article",
  "grammar_particle",
  "grammar_pronoun",
  "grammar_plural",
  "grammar_negation",
  "grammar_comparison",
  "vocab_wrong_word",
  "vocab_missing_word",
  "vocab_extra_word",
  "vocab_register",
  "vocab_false_friend",
  "spelling",
  "accent_or_diacritic",
  "pronunciation_segment",
  "pronunciation_stress",
  "pronunciation_tone",
  "pronunciation_intonation",
  "fluency_pause",
  "fluency_filler",
  "discourse_connective",
  "register_politeness",
  "other",
] as const;
export const errorCategorySchema = z.enum(ERROR_CATEGORIES);
export type ErrorCategory = z.infer<typeof errorCategorySchema>;

/**
 * 1 = nitpick (suppressed in free conversation), 2 = noticeable,
 * 3 = meaning-breaking.
 */
export const errorSeveritySchema = z.number().int().min(1).max(3);
export type ErrorSeverity = z.infer<typeof errorSeveritySchema>;

export const errorSourceSchema = z.enum(["exercise", "tutor_text", "tutor_voice", "placement"]);
export type ErrorSource = z.infer<typeof errorSourceSchema>;

export const errorRecordSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  target_language_id: uuidSchema,
  concept_id: uuidSchema.nullable(),
  concept_key: conceptKeySchema.nullable(),
  source: errorSourceSchema,
  category: errorCategorySchema,
  subcategory_key: z.string().min(1).nullable(),
  original_text: z.string(),
  corrected_text: z.string(),
  explanation: z.string().nullable(),
  severity: errorSeveritySchema,
  is_meaning_changing: z.boolean(),
  created_at: isoDateTimeSchema,
});
export type ErrorRecord = z.infer<typeof errorRecordSchema>;

export const GOAL_TYPES = ["travel", "work", "exam", "family", "media", "other"] as const;
export const goalTypeSchema = z.enum(GOAL_TYPES);
export type GoalType = z.infer<typeof goalTypeSchema>;

/** One row per (user, target language): adding a target language is not a schema change. */
export const learnerLanguageProfileSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  target_language_id: uuidSchema,
  native_language_id: uuidSchema,
  cefr_self: cefrLevelSchema.nullable(),
  cefr_assessed: cefrLevelSchema.nullable(),
  goal: goalTypeSchema.nullable(),
  goal_note: z.string().nullable(),
  daily_minutes_target: z.number().int().min(5).max(240),
  current_streak: z.number().int().min(0),
  longest_streak: z.number().int().min(0),
  is_active: z.boolean(),
  onboarding_completed_at: isoDateTimeSchema.nullable(),
});
export type LearnerLanguageProfile = z.infer<typeof learnerLanguageProfileSchema>;

/** Explicit self-rating, used only for vocabulary flashcards. 1=again … 4=easy. */
export const srsRatingSchema = z.number().int().min(1).max(4);
export type SrsRating = z.infer<typeof srsRatingSchema>;

export const conceptMasterySchema = z.object({
  concept_key: conceptKeySchema,
  state: masteryStateSchema,
  stability: z.number().min(0),
  accuracy: z.number().min(0).max(1),
  due_at: isoDateTimeSchema.nullable(),
  last_seen_days_ago: z.number().min(0).nullable(),
});
export type ConceptMastery = z.infer<typeof conceptMasterySchema>;

/**
 * Dashboard payload. Derived from `activity_day` and `concept_mastery` only —
 * never aggregated from raw attempts on a user request. No vanity metrics:
 * every field here is intended to change what the learner does next.
 */
export const progressSummarySchema = z.object({
  streak_days: z.number().int().min(0),
  minutes_this_week: z.number().int().min(0),
  lessons_completed: z.number().int().min(0),
  concepts_mastered: z.number().int().min(0),
  concepts_learning: z.number().int().min(0),
  due_today: z.number().int().min(0),
  vocabulary_known: z.number().int().min(0),
  weak_areas: z.array(
    z.object({
      concept_key: conceptKeySchema,
      title: z.string().min(1),
      dominant_category: errorCategorySchema,
      recent_error_count: z.number().int().min(0),
    }),
  ),
});
export type ProgressSummary = z.infer<typeof progressSummarySchema>;

// ---------------------------------------------------------------------------
// Usage and entitlement
// ---------------------------------------------------------------------------

/**
 * Metered metrics. Voice is the only one with meaningful marginal cost, but all
 * five are recorded so cost attribution is possible per learner and per model.
 */
export const USAGE_METRICS = [
  "voice_seconds",
  "stt_seconds",
  "tts_characters",
  "llm_input_tokens",
  "llm_output_tokens",
] as const;
export const usageMetricSchema = z.enum(USAGE_METRICS);
export type UsageMetric = z.infer<typeof usageMetricSchema>;

export const entitlementTierSchema = z.enum(["free", "pro"]);
export type EntitlementTier = z.infer<typeof entitlementTierSchema>;

export const usageCurrentSchema = z.object({
  tier: entitlementTierSchema,
  period_start: isoDateSchema,
  period_end: isoDateSchema,
  metrics: z.array(
    z.object({
      metric: usageMetricSchema,
      quantity: z.number().min(0),
      limit: z.number().min(0).nullable(),
    }),
  ),
  voice_seconds_remaining: z.number().min(0),
  resets_at: isoDateTimeSchema,
});
export type UsageCurrent = z.infer<typeof usageCurrentSchema>;

/** Explanation language is always explicit so the client never guesses. */
export const explanationLanguageSchema = z.object({
  bcp47: bcp47TagSchema,
  direction: z.enum(["ltr", "rtl", "ttb"]),
});
export type ExplanationLanguage = z.infer<typeof explanationLanguageSchema>;
