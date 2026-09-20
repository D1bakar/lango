// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * Learner profile routes.
 *
 * Manages per-user, per-target-language profiles. One profile can be active
 * at a time; adding a second target language is not a schema change.
 *
 * See docs/architecture/03-api-contracts.md § 2.
 */

import type { FastifyInstance } from "fastify";
import { createProblem, sendProblem } from "../problem";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

const VALID_GOALS = ["travel", "work", "exam", "family", "media", "other"];
const VALID_CEFR = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];

export async function registerLearnerRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // POST /v1/learner/languages
  // Create or activate a learner language profile.
  // ---------------------------------------------------------------------------
  app.post(
    "/v1/learner/languages",
    {
      preHandler: [requireAuth],
      schema: {
        body: {
          type: "object",
          required: ["target_language_id", "native_language_id"],
          properties: {
            target_language_id: { type: "string", format: "uuid" },
            native_language_id: { type: "string", format: "uuid" },
            cefr_self: { type: "string", enum: VALID_CEFR },
            goal: { type: "string", enum: VALID_GOALS },
            goal_note: { type: "string", maxLength: 500 },
            daily_minutes_target: { type: "integer", minimum: 5, maximum: 240 },
          },
        },
      },
    },
    async (request, reply) => {
      const { sub } = (request as AuthenticatedRequest).user;
      const body = request.body as {
        target_language_id: string;
        native_language_id: string;
        cefr_self?: string;
        goal?: string;
        goal_note?: string;
        daily_minutes_target?: number;
      };

      const { prisma } = await import("@lingua/db");

      // Verify the languages exist
      const [targetLang, nativeLang] = await Promise.all([
        prisma.language.findUnique({ where: { id: body.target_language_id } }),
        prisma.language.findUnique({ where: { id: body.native_language_id } }),
      ]);

      if (!targetLang) {
        sendProblem(
          reply,
          createProblem({
            code: "not_found",
            detail: "Target language not found.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      if (!nativeLang) {
        sendProblem(
          reply,
          createProblem({
            code: "not_found",
            detail: "Native language not found.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      // Find the language pair
      const pair = await prisma.languagePair.findUnique({
        where: {
          native_language_id_target_language_id: {
            native_language_id: body.native_language_id,
            target_language_id: body.target_language_id,
          },
        },
      });

      if (!pair) {
        sendProblem(
          reply,
          createProblem({
            code: "not_found",
            detail: "No language pair exists between these languages.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      // Deactivate any currently active profile for this user
      await prisma.learnerLanguageProfile.updateMany({
        where: { user_id: sub, is_active: true },
        data: { is_active: false },
      });

      // Create or update the profile
      const profile = await prisma.learnerLanguageProfile.upsert({
        where: {
          user_id_target_language_id: {
            user_id: sub,
            target_language_id: body.target_language_id,
          },
        },
        update: {
          native_language_id: body.native_language_id,
          language_pair_id: pair.id,
          cefr_self: body.cefr_self ?? undefined,
          goal: body.goal ?? undefined,
          goal_note: body.goal_note ?? undefined,
          daily_minutes_target: body.daily_minutes_target ?? 15,
          is_active: true,
        },
        create: {
          user_id: sub,
          target_language_id: body.target_language_id,
          native_language_id: body.native_language_id,
          language_pair_id: pair.id,
          cefr_self: body.cefr_self ?? undefined,
          goal: body.goal ?? undefined,
          goal_note: body.goal_note ?? undefined,
          daily_minutes_target: body.daily_minutes_target ?? 15,
          is_active: true,
        },
        include: {
          target_language: true,
          native_language: true,
        },
      });

      reply.status(201).send({
        id: profile.id,
        target_language: {
          id: profile.target_language.id,
          tag: profile.target_language.bcp47_tag,
          english_name: profile.target_language.english_name,
        },
        native_language: {
          id: profile.native_language.id,
          tag: profile.native_language.bcp47_tag,
          english_name: profile.native_language.english_name,
        },
        cefr_self: profile.cefr_self,
        goal: profile.goal,
        daily_minutes_target: profile.daily_minutes_target,
        is_active: profile.is_active,
        created_at: profile.created_at,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /v1/learner/languages/:id
  // Update an existing learner language profile.
  // ---------------------------------------------------------------------------
  app.patch(
    "/v1/learner/languages/:id",
    {
      preHandler: [requireAuth],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            cefr_self: { type: "string", enum: VALID_CEFR },
            goal: { type: "string", enum: VALID_GOALS },
            goal_note: { type: "string", maxLength: 500 },
            daily_minutes_target: { type: "integer", minimum: 5, maximum: 240 },
          },
        },
      },
    },
    async (request, reply) => {
      const { sub } = (request as AuthenticatedRequest).user;
      const { id } = request.params as { id: string };
      const body = request.body as {
        cefr_self?: string;
        goal?: string;
        goal_note?: string;
        daily_minutes_target?: number;
      };

      const { prisma } = await import("@lingua/db");

      // Verify ownership
      const existing = await prisma.learnerLanguageProfile.findFirst({
        where: { id, user_id: sub },
      });

      if (!existing) {
        sendProblem(
          reply,
          createProblem({
            code: "not_found",
            detail: "Learner profile not found.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      const profile = await prisma.learnerLanguageProfile.update({
        where: { id },
        data: {
          cefr_self: body.cefr_self ?? undefined,
          goal: body.goal ?? undefined,
          goal_note: body.goal_note ?? undefined,
          daily_minutes_target: body.daily_minutes_target ?? undefined,
        },
        include: {
          target_language: true,
          native_language: true,
        },
      });

      reply.send({
        id: profile.id,
        target_language: {
          id: profile.target_language.id,
          tag: profile.target_language.bcp47_tag,
          english_name: profile.target_language.english_name,
        },
        native_language: {
          id: profile.native_language.id,
          tag: profile.native_language.bcp47_tag,
          english_name: profile.native_language.english_name,
        },
        cefr_self: profile.cefr_self,
        goal: profile.goal,
        daily_minutes_target: profile.daily_minutes_target,
        is_active: profile.is_active,
        created_at: profile.created_at,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /v1/learner/languages
  // List all profiles for the authenticated user.
  // ---------------------------------------------------------------------------
  app.get("/v1/learner/languages", { preHandler: [requireAuth] }, async (request, reply) => {
    const { sub } = (request as AuthenticatedRequest).user;

    const { prisma } = await import("@lingua/db");
    const profiles = await prisma.learnerLanguageProfile.findMany({
      where: { user_id: sub },
      include: {
        target_language: true,
        native_language: true,
      },
      orderBy: { created_at: "desc" },
    });

    reply.send(
      profiles.map((profile) => ({
        id: profile.id,
        target_language: {
          id: profile.target_language.id,
          tag: profile.target_language.bcp47_tag,
          english_name: profile.target_language.english_name,
        },
        native_language: {
          id: profile.native_language.id,
          tag: profile.native_language.bcp47_tag,
          english_name: profile.native_language.english_name,
        },
        cefr_self: profile.cefr_self,
        goal: profile.goal,
        daily_minutes_target: profile.daily_minutes_target,
        is_active: profile.is_active,
        onboarding_completed_at: profile.onboarding_completed_at,
        created_at: profile.created_at,
      })),
    );
  });

  // ---------------------------------------------------------------------------
  // POST /v1/learning-plan
  // Deterministic server-side plan from assessment + goal + availability.
  // Not LLM-generated — must be testable and explainable.
  // ---------------------------------------------------------------------------
  app.post(
    "/v1/learning-plan",
    {
      preHandler: [requireAuth],
      schema: {
        body: {
          type: "object",
          required: ["profile_id"],
          properties: {
            profile_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { sub } = (request as AuthenticatedRequest).user;
      const { profile_id } = request.body as { profile_id: string };

      const { prisma } = await import("@lingua/db");

      // Verify ownership
      const profile = await prisma.learnerLanguageProfile.findFirst({
        where: { id: profile_id, user_id: sub },
        include: {
          target_language: true,
          native_language: true,
          language_pair: {
            include: {
              content_packs: {
                where: { status: "published" },
                orderBy: { cefr_from: "asc" },
              },
            },
          },
        },
      });

      if (!profile) {
        sendProblem(
          reply,
          createProblem({
            code: "not_found",
            detail: "Learner profile not found.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      // Find the best matching pack based on CEFR level
      const packs = profile.language_pair?.content_packs ?? [];
      const cefrLadder = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
      const selectedLevel = profile.cefr_self ?? "A0";
      const levelIndex = cefrLadder.indexOf(selectedLevel);

      // Find the pack whose range includes the learner's level
      const matchingPack =
        packs.find((pack) => {
          const fromIndex = cefrLadder.indexOf(pack.cefr_from);
          const toIndex = cefrLadder.indexOf(pack.cefr_to);
          return levelIndex >= fromIndex && levelIndex <= toIndex;
        }) ?? packs[0];

      // Calculate daily session breakdown
      const totalMinutes = profile.daily_minutes_target;
      const reviewMinutes = Math.max(3, Math.round(totalMinutes * 0.2));
      const speakMinutes = 5;
      const lessonMinutes = Math.max(4, totalMinutes - reviewMinutes - speakMinutes);

      // Estimate completion time
      const packHours = matchingPack
        ? Math.round(
            (matchingPack as unknown as { estimated_minutes: number }).estimated_minutes / 60,
          )
        : 0;
      const daysToComplete = matchingPack
        ? Math.ceil(
            (matchingPack as unknown as { estimated_minutes: number }).estimated_minutes /
              totalMinutes,
          )
        : 0;

      // Mark onboarding as completed
      await prisma.learnerLanguageProfile.update({
        where: { id: profile_id },
        data: { onboarding_completed_at: new Date() },
      });

      reply.send({
        profile_id: profile.id,
        target_language: {
          tag: profile.target_language.bcp47_tag,
          english_name: profile.target_language.english_name,
        },
        native_language: {
          tag: profile.native_language.bcp47_tag,
          english_name: profile.native_language.english_name,
        },
        level: selectedLevel,
        goal: profile.goal,
        daily_minutes: totalMinutes,
        pack: matchingPack
          ? {
              pack_key: (matchingPack as unknown as { pack_key: string }).pack_key,
              title: matchingPack.title,
              cefr_from: matchingPack.cefr_from,
              cefr_to: matchingPack.cefr_to,
              estimated_hours: packHours,
              status: matchingPack.status,
            }
          : null,
        daily_loop: {
          lesson_minutes: lessonMinutes,
          speak_minutes: speakMinutes,
          review_minutes: reviewMinutes,
        },
        estimated_days_to_complete: daysToComplete,
        created_at: new Date(),
      });
    },
  );
}
