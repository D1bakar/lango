// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";
import { contentStatusSchema } from "./curriculum";
import {
  bcp47TagSchema,
  cefrLevelSchema,
  morphologySchema,
  scriptSchema,
  textDirectionSchema,
  tokenizerProfileSchema,
} from "./language";
import { errorCategorySchema } from "./learner";
import { isoDateSchema } from "./primitives";

/**
 * Content file schemas.
 *
 * These describe what an author writes in `content/**`, which is NOT the same
 * shape as the database rows those files become. Keeping the two separate means
 * a pack author never writes a UUID or a timestamp, and a schema change to the
 * database does not churn authored content.
 *
 * See docs/architecture/06-language-pack-spec.md.
 */

export const CONTENT_SCHEMA_VERSION = 1;

export const ttsConfigSchema = z.object({
  /** Provider voice id. Optional until an audio provider is wired up. */
  default_voice_id: z.string().min(1).optional(),
  rate: z.number().min(0.5).max(2).default(1),
});

/**
 * Speech recognition hints.
 *
 * `error_heuristics` is authored, human-reviewed knowledge about what mistakes
 * learners of this language actually make. It is seeded into the mentor's
 * context so the tutor does not have to reason unaided about grammar it may
 * know less about than the pack author does.
 */
export const sttConfigSchema = z.object({
  language_code: z.string().min(1).optional(),
  bias_strategy: z.enum(["none", "lesson_vocabulary"]).default("lesson_vocabulary"),
  error_heuristics: z
    .array(
      z.object({
        category: errorCategorySchema,
        subcategory_key: z.string().min(1).nullable().default(null),
        signals: z.array(z.string().min(1)).min(1),
      }),
    )
    .default([]),
});

export const contentPolicySchema = z.object({
  forbidden_terms: z.array(z.string().min(1)).default([]),
  min_age_rating: z.enum(["general", "teen", "adult"]).default("general"),
});

/** One file per language, in `content/languages/{tag}.yaml`. */
export const languageFileSchema = z.object({
  schema_version: z.literal(CONTENT_SCHEMA_VERSION),
  tag: bcp47TagSchema,
  english_name: z.string().min(1),
  native_name: z.string().min(1),
  script: scriptSchema,
  text_direction: textDirectionSchema,
  transliteration_scheme: z.string().min(1).nullable().default(null),
  transliteration_required: z.boolean().default(false),
  tokenizer_profile: tokenizerProfileSchema.default("whitespace"),
  /** Must match a file in `content/normalization/`. Checked by the loader. */
  normalization_profile: z.string().min(1),
  morphology: morphologySchema.optional(),
  tts: ttsConfigSchema.optional(),
  stt: sttConfigSchema.optional(),
  content_policy: contentPolicySchema.optional(),
  notes: z.string().optional(),
});
export type LanguageFile = z.infer<typeof languageFileSchema>;

/** One file per pack, in `content/packs/{native}--{target}/{cefr}/pack.yaml`. */
export const packFileSchema = z.object({
  schema_version: z.literal(CONTENT_SCHEMA_VERSION),
  pack_key: z
    .string()
    .regex(
      /^[a-z]{2,3}--[a-z]{2,3}-[a-z0-9]+$/,
      "Pack keys look like `en--es-a1`: the native tag, a double dash, the target tag, then the level.",
    ),
  native_language: bcp47TagSchema,
  target_language: bcp47TagSchema,
  cefr_from: cefrLevelSchema,
  cefr_to: cefrLevelSchema,
  title: z.string().min(1).max(120),
  description: z.string().min(1),
  estimated_minutes: z.number().int().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Semantic version, for example 1.0.0."),
  license: z.string().min(1),
  status: contentStatusSchema,
  authors: z
    .array(z.object({ name: z.string().min(1), contact: z.string().min(1).optional() }))
    .default([]),
  review: z.object({
    status: z.enum(["draft", "in_review", "published"]),
    reviewers: z
      .array(
        z.object({
          name: z.string().min(1),
          role: z.enum(["native_speaker", "curriculum"]),
        }),
      )
      .default([]),
  }),
  changelog: z
    .array(
      z.object({
        version: z.string().min(1),
        date: isoDateSchema,
        notes: z.string().min(1),
      }),
    )
    .default([]),
  /**
   * REQUIRED for a MAJOR version bump: maps removed or renamed concept keys so
   * learner mastery survives the edit. Silent loss of progress is the one
   * content mistake users never forgive.
   */
  migrations: z
    .array(
      z.object({
        from_key: z.string().min(1),
        to_key: z.string().min(1),
        strategy: z.enum(["carry_mastery", "drop"]),
      }),
    )
    .default([]),
});
export type PackFile = z.infer<typeof packFileSchema>;

// ---------------------------------------------------------------------------
// API shapes for catalog reads
// ---------------------------------------------------------------------------

/**
 * Bounded catalogs identify content-defined resources by their stable content
 * key — the BCP 47 tag, the pack key, the concept key — not by a database UUID.
 * UUIDs are internal storage identifiers, and a content key is the same value in
 * every environment, in a URL, and in a pack file.
 */
export const packSummarySchema = z.object({
  pack_key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  cefr_from: cefrLevelSchema,
  cefr_to: cefrLevelSchema,
  estimated_minutes: z.number().int().min(0),
  version: z.string().min(1),
  license: z.string().min(1),
  status: contentStatusSchema,
});
export type PackSummary = z.infer<typeof packSummarySchema>;

/**
 * `GET /v1/content/status`. An operations endpoint for verifying what content the
 * running process actually loaded.
 *
 * Deliberately counts only: the absolute content path is never returned, because
 * leaking server filesystem layout to a client is a free gift to an attacker.
 */
export const contentLoadStatusSchema = z.object({
  schema_version: z.number().int().min(1),
  languages: z.number().int().min(0),
  normalization_profiles: z.number().int().min(0),
  packs: z.number().int().min(0),
  packs_published: z.number().int().min(0),
});
export type ContentLoadStatus = z.infer<typeof contentLoadStatusSchema>;

/** `GET /v1/languages/:tag/pairs` element. */
export const languagePairSummarySchema = z.object({
  native_tag: bcp47TagSchema,
  target: z.object({
    tag: bcp47TagSchema,
    english_name: z.string().min(1),
    native_name: z.string().min(1),
    script: scriptSchema,
    direction: textDirectionSchema,
  }),
  packs: z.array(packSummarySchema),
});
export type LanguagePairSummary = z.infer<typeof languagePairSummarySchema>;
