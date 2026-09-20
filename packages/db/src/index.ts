// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * @lingua/db — Prisma client singleton and re-exports.
 *
 * Import the client from here, never instantiate PrismaClient directly.
 * The singleton avoids connection pool exhaustion when multiple modules
 * import the client during development (Next.js hot-reload, Vitest workers).
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma types for convenience
export type {
  User,
  Language,
  LanguagePair,
  ContentPack,
  Course,
  Unit,
  Lesson,
  Concept,
  Exercise,
  LearnerLanguageProfile,
  Enrollment,
  LessonProgress,
  StudySession,
  ExerciseAttempt,
  ConceptMastery,
  ReviewLog,
  VocabItem,
  ErrorRecord,
  ActivityDay,
  PlacementAttempt,
  TutorSession,
  TutorMessage,
  AuthSession,
  OAuthAccount,
  Entitlement,
  UsageLedger,
  UsageCounter,
  AuditLog,
  ContentReport,
  EvalRun,
} from "@prisma/client";
