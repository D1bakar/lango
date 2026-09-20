// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./primitives";

/**
 * CEFR levels. `A0` is our own extension for absolute beginners who cannot yet
 * produce a sentence; it is not part of the published CEFR scale.
 */
export const CEFR_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const cefrLevelSchema = z.enum(CEFR_LEVELS);
export type CefrLevel = z.infer<typeof cefrLevelSchema>;

/**
 * Text direction. Application code branches on this value, so it is a closed
 * enum: a new direction requires a rendering implementation, not just data.
 */
export const TEXT_DIRECTIONS = ["ltr", "rtl", "ttb"] as const;
export const textDirectionSchema = z.enum(TEXT_DIRECTIONS);
export type TextDirection = z.infer<typeof textDirectionSchema>;

/**
 * Tokenization strategy. Closed enum for the same reason as direction: each
 * value corresponds to an implementation in the grading and vocabulary layers.
 */
export const TOKENIZER_PROFILES = ["whitespace", "cjk", "thai"] as const;
export const tokenizerProfileSchema = z.enum(TOKENIZER_PROFILES);
export type TokenizerProfile = z.infer<typeof tokenizerProfileSchema>;

/**
 * Scripts we currently have content or tooling for.
 *
 * INFORMATIONAL ONLY. The schema validates the ISO 15924 *format* rather than
 * closing the list, so adding a language pack never requires a code change. This
 * is the multi-language-as-data rule from ADR-0008.
 */
export const KNOWN_SCRIPTS = [
  "Latn",
  "Cyrl",
  "Grek",
  "Arab",
  "Hebr",
  "Deva",
  "Beng",
  "Taml",
  "Telu",
  "Thai",
  "Laoo",
  "Khmr",
  "Mymr",
  "Tibt",
  "Ethi",
  "Geor",
  "Armn",
  "Hani",
  "Hant",
  "Hans",
  "Jpan",
  "Kore",
  "Hang",
] as const;

export const scriptSchema = z
  .string()
  .regex(
    /^[A-Z][a-z]{3}$/,
    "Must be a four-letter ISO 15924 script code (for example Latn, Cyrl, Jpan).",
  );
export type Script = z.infer<typeof scriptSchema>;

/** BCP 47 language tag, e.g. `es`, `pt-BR`, `zh-Hans`. */
export const bcp47TagSchema = z
  .string()
  .regex(
    /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
    "Must be a BCP 47 language tag (for example es, pt-BR, zh-Hans).",
  );
export type Bcp47Tag = z.infer<typeof bcp47TagSchema>;

/**
 * Morphological features. Drives which explanation templates and error
 * categories apply. Every flag defaults to false so a pack author only declares
 * what the language actually has.
 */
export const morphologySchema = z.object({
  has_grammatical_gender: z.boolean().default(false),
  genders: z.array(z.string().min(1)).default([]),
  has_cases: z.boolean().default(false),
  case_count: z.number().int().min(0).max(20).default(0),
  has_counter_words: z.boolean().default(false),
  has_formal_register: z.boolean().default(false),
  has_diacritics: z.boolean().default(false),
  has_tones: z.boolean().default(false),
});
export type Morphology = z.infer<typeof morphologySchema>;

/** A language as stored. Everything the engine branches on lives here. */
export const languageSchema = z.object({
  id: uuidSchema,
  bcp47_tag: bcp47TagSchema,
  english_name: z.string().min(1),
  native_name: z.string().min(1),
  script: scriptSchema,
  text_direction: textDirectionSchema,
  transliteration_scheme: z.string().min(1).nullable(),
  transliteration_required: z.boolean(),
  tokenizer_profile: tokenizerProfileSchema,
  normalization_profile: z.string().min(1),
  morphology: morphologySchema,
  is_active: z.boolean(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Language = z.infer<typeof languageSchema>;

/**
 * Compact language payload for selection screens. Mirrors `GET /v1/languages`.
 *
 * Identified by `tag`, not by a database UUID: the BCP 47 tag is the stable key
 * in a URL, in a pack file, and in every environment. The database assigns its
 * own internal id at import time.
 */
export const languageSummarySchema = z.object({
  tag: bcp47TagSchema,
  english_name: z.string().min(1),
  native_name: z.string().min(1),
  script: scriptSchema,
  direction: textDirectionSchema,
  /** Packs a learner can start from, using this as their native language. */
  packs_from: z.number().int().min(0),
  /** Packs that teach this language as the target. */
  packs_into: z.number().int().min(0),
});
export type LanguageSummary = z.infer<typeof languageSummarySchema>;

/**
 * A curriculum is authored for a language PAIR, not a target language alone,
 * because grammar explanations and error patterns are L1-specific.
 */
export const languagePairSchema = z.object({
  id: uuidSchema,
  native_language_id: uuidSchema,
  target_language_id: uuidSchema,
  is_active: z.boolean(),
});
export type LanguagePair = z.infer<typeof languagePairSchema>;

/**
 * Grading normalization rules for a language.
 *
 * This is the contract that makes grading correct across languages. Spanish
 * requires accents; Japanese accepts kana for kanji at A1; Arabic treats short
 * vowels as optional. A single generic normalizer marks all three wrong.
 */
export const normalizationRulesSchema = z.object({
  trim: z.boolean().default(true),
  collapse_whitespace: z.boolean().default(true),
  case_sensitive: z.boolean().default(false),
  diacritics: z.enum(["required", "optional", "ignore"]).default("required"),
  punctuation: z.enum(["ignore", "required"]).default("ignore"),
  inverted_punctuation: z.enum(["ignore", "required"]).default("ignore"),
  accept_missing_opening_marks: z.boolean().default(false),
  numeric_normalization: z.boolean().default(true),
  ignore_articles: z.boolean().default(false),
  /** Scripts treated as equivalent, e.g. kana accepted for kanji. */
  script_folding: z.array(z.string().min(1)).default([]),
  width_normalization: z.boolean().default(false),
});
export type NormalizationRules = z.infer<typeof normalizationRulesSchema>;

export const normalizationProfileSchema = z.object({
  schema_version: z.literal(1),
  profile: z.string().min(1),
  rules: normalizationRulesSchema,
  notes: z.string().optional(),
});
export type NormalizationProfile = z.infer<typeof normalizationProfileSchema>;
