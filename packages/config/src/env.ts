// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";

/**
 * Environment validation.
 *
 * Validation is deliberately LAZY. Reading and validating at module import time
 * would make every test that transitively imports this file depend on a fully
 * populated environment. Call `getServerEnv()` where the values are needed.
 *
 * Secrets are never defaulted and never hardcoded. See SECURITY.md.
 */

export const nodeEnvSchema = z.enum(["development", "test", "production"]);
export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  LOG_LEVEL: logLevelSchema.default("info"),

  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  /** Comma-separated browser origins permitted to call the API. */
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // ---------------------------------------------------------------------------
  // Optional until Phase 3 provisions infrastructure. These become REQUIRED when
  // the corresponding feature lands: the schema should fail loudly at boot rather
  // than throw at the first request.
  // ---------------------------------------------------------------------------

  /** PostgreSQL connection string. Required from Phase 3. */
  DATABASE_URL: z.string().min(1).optional(),
  /** Redis connection string. Required from Phase 3 (rate limits, quota counters). */
  REDIS_URL: z.string().min(1).optional(),
  /** Signing secret for session tokens. Minimum 32 characters. Required from Phase 3. */
  AUTH_SECRET: z.string().min(32).optional(),

  /** Object storage (S3-compatible). Required from Phase 5 for voice turns. */
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),

  /** AI providers. Required from Phase 5. */
  LLM_API_KEY: z.string().min(1).optional(),
  STT_API_KEY: z.string().min(1).optional(),
  TTS_API_KEY: z.string().min(1).optional(),

  /** Observability. Optional everywhere; absence must never break a request. */
  SENTRY_DSN: z.string().min(1).optional(),
  POSTHOG_API_KEY: z.string().min(1).optional(),
  LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
  LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvSource = Record<string, string | undefined>;

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

let cached: ServerEnv | undefined;

/**
 * Validate and return the server environment.
 *
 * @throws EnvValidationError listing every invalid variable, so a misconfigured
 *         deployment fails at boot with an actionable message.
 */
export function getServerEnv(source: EnvSource = process.env): ServerEnv {
  if (cached) {
    return cached;
  }

  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      `Invalid environment configuration:\n${formatIssues(result.error)}\n\n` +
        `Copy .env.example to .env and fill in the missing values.`,
    );
  }

  cached = result.data;
  return cached;
}

/** Test-only escape hatch: clears the memoized environment. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

/** Split a comma-separated list, trimming entries and dropping empties. */
export function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Permitted browser origins as an array. */
export function getCorsOrigins(env: ServerEnv = getServerEnv()): string[] {
  return parseCommaSeparatedList(env.CORS_ORIGINS);
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}
