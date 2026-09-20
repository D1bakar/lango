// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";

/**
 * Stable machine-readable error codes.
 *
 * Clients branch on `code`, never on `detail` or HTTP status alone. In
 * particular `quota_exhausted` (out of free allocation) and `rate_limited`
 * (going too fast) must never be conflated.
 */
export const API_ERROR_CODES = [
  "unauthenticated",
  "token_expired",
  "forbidden",
  "not_found",
  "validation_failed",
  "email_taken",
  "invalid_credentials",
  "email_not_verified",
  "rate_limited",
  "quota_exhausted",
  "voice_quota_exhausted",
  "audio_too_long",
  "audio_too_large",
  "audio_unsupported_format",
  "provider_unavailable",
  "session_not_active",
  "content_version_conflict",
  "feature_not_in_tier",
  "internal",
] as const;
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const problemDetailsSchema = z.object({
  /** URI identifying the problem type. */
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1),
  /** Request path where the problem occurred. */
  instance: z.string().min(1),
  code: apiErrorCodeSchema,
  /** Field-level failures for `validation_failed`. */
  errors: z
    .array(
      z.object({
        path: z.string().min(1),
        message: z.string().min(1),
      }),
    )
    .optional(),
  /** Correlation id, also returned as the X-Request-Id header. */
  request_id: z.string().min(1),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

/**
 * HTTP status for each error code. Kept here so the API layer and the client
 * agree on the mapping without duplicating a switch statement.
 *
 * Note `402` for quota exhaustion: semantically correct, formally reserved.
 * Documented as an open question in docs/architecture/03-api-contracts.md.
 */
export const ERROR_CODE_STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  token_expired: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  email_taken: 409,
  invalid_credentials: 401,
  email_not_verified: 403,
  rate_limited: 429,
  quota_exhausted: 402,
  voice_quota_exhausted: 402,
  audio_too_long: 413,
  audio_too_large: 413,
  audio_unsupported_format: 415,
  provider_unavailable: 503,
  session_not_active: 409,
  content_version_conflict: 409,
  feature_not_in_tier: 403,
  internal: 500,
};

/**
 * Error codes that occur INSIDE a tutoring stream rather than as an HTTP
 * response. These are a wider set than the HTTP problems: a turn can fail
 * halfway through, long after a 200 was sent.
 *
 * `transcription_low_confidence` belongs here by design. A low-confidence
 * transcript is not a client error and must never be recorded as a learner
 * mistake; the client is expected to ask the learner to repeat.
 */
export const TUTOR_STREAM_ERROR_CODES = [
  "transcription_low_confidence",
  "provider_unavailable",
  "llm_timeout",
  "tts_failed",
  "quota_exhausted",
  "output_contract_violation",
  "internal",
] as const;
export const tutorStreamErrorCodeSchema = z.enum(TUTOR_STREAM_ERROR_CODES);
export type TutorStreamErrorCode = z.infer<typeof tutorStreamErrorCodeSchema>;
