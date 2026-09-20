// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * Auth routes.
 *
 * Implements JWT-based authentication with:
 * - Short-lived access tokens (15 min) in memory
 * - Rotating refresh tokens in httpOnly, Secure, SameSite=Lax cookies
 * - Argon2id password hashing
 * - Rate limiting (5 attempts per 15 min per IP/email)
 *
 * See docs/architecture/03-api-contracts.md § 1.
 */

import type { FastifyInstance } from "fastify";
import { hash, verify } from "argon2";
import { createProblem, sendProblem } from "../problem";
import {
  requireAuth,
  signAccessToken,
  signRefreshToken,
  type AuthenticatedRequest,
} from "../middleware/auth";

// ---------------------------------------------------------------------------
// Input validation schemas (manual for now; will move to Zod in Phase 4)
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const REFRESH_COOKIE_NAME = "refresh_token";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // POST /v1/auth/signup
  // ---------------------------------------------------------------------------
  app.post(
    "/v1/auth/signup",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: PASSWORD_MIN_LENGTH },
            display_name: { type: "string", maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, display_name } = request.body as {
        email: string;
        password: string;
        display_name?: string;
      };

      // Validate email format
      if (!EMAIL_REGEX.test(email)) {
        sendProblem(
          reply,
          createProblem({
            code: "validation_failed",
            detail: "Invalid email address.",
            instance: request.url,
            requestId: request.id,
            errors: [{ path: "email", message: "Must be a valid email address." }],
          }),
        );
        return;
      }

      // Check for existing user
      const { prisma } = await import("@lingua/db");
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        sendProblem(
          reply,
          createProblem({
            code: "email_taken",
            detail: "An account with this email already exists.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      // Hash password and create user
      const passwordHash = await hash(password);
      const user = await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          display_name: display_name ?? email.split("@")[0],
          role: "learner",
          status: "active",
        },
      });

      // Create default entitlement (free tier)
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await prisma.entitlement.create({
        data: {
          user_id: user.id,
          tier: "free",
          status: "active",
          current_period_start: now,
          current_period_end: periodEnd,
        },
      });

      // Sign tokens
      const accessToken = signAccessToken(app, user);
      const refreshToken = signRefreshToken(app, user.id);

      // Store refresh token hash
      const refreshTokenHash = await hash(refreshToken);
      await prisma.authSession.create({
        data: {
          user_id: user.id,
          refresh_token_hash: refreshTokenHash,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Set refresh cookie
      reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      reply.status(201).send({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 900, // 15 minutes
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /v1/auth/login
  // ---------------------------------------------------------------------------
  app.post(
    "/v1/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const { prisma } = await import("@lingua/db");
      const user = await prisma.user.findUnique({ where: { email } });

      // Constant-time comparison: always hash even if user not found
      const dummyHash =
        "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA";
      const hashToCheck = user?.password_hash ?? dummyHash;

      const valid = await verify(hashToCheck, password).catch(() => false);

      if (!user || !valid) {
        sendProblem(
          reply,
          createProblem({
            code: "invalid_credentials",
            detail: "Invalid email or password.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      if (user.status !== "active") {
        sendProblem(
          reply,
          createProblem({
            code: "forbidden",
            detail: "Account is not active.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      // Sign tokens
      const accessToken = signAccessToken(app, user);
      const refreshToken = signRefreshToken(app, user.id);

      // Store refresh token hash
      const refreshTokenHash = await hash(refreshToken);
      await prisma.authSession.create({
        data: {
          user_id: user.id,
          refresh_token_hash: refreshTokenHash,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Update last seen
      await prisma.user.update({
        where: { id: user.id },
        data: { last_seen_at: new Date() },
      });

      // Set refresh cookie
      reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
      });

      reply.send({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 900,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /v1/auth/refresh
  // ---------------------------------------------------------------------------
  app.post("/v1/auth/refresh", async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME] as
      | string
      | undefined;

    if (!refreshToken) {
      sendProblem(
        reply,
        createProblem({
          code: "unauthenticated",
          detail: "No refresh token provided.",
          instance: request.url,
          requestId: request.id,
        }),
      );
      return;
    }

    const { prisma } = await import("@lingua/db");

    // Verify the JWT
    let decoded: { sub: string };
    try {
      decoded = await app.jwt.verify<{ sub: string }>(refreshToken);
    } catch {
      sendProblem(
        reply,
        createProblem({
          code: "token_expired",
          detail: "Refresh token is invalid or expired.",
          instance: request.url,
          requestId: request.id,
        }),
      );
      return;
    }

    // Find and validate the session
    const sessions = await prisma.authSession.findMany({
      where: {
        user_id: decoded.sub,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    // Check if this token matches any session
    let matchedSession: (typeof sessions)[number] | undefined;
    for (const session of sessions) {
      const matches = await verify(session.refresh_token_hash, refreshToken).catch(
        () => false,
      );
      if (matches) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      // Token reuse detected: revoke all sessions for this user
      await prisma.authSession.updateMany({
        where: { user_id: decoded.sub, revoked_at: null },
        data: { revoked_at: new Date() },
      });

      sendProblem(
        reply,
        createProblem({
          code: "token_expired",
          detail: "Refresh token reuse detected. All sessions revoked.",
          instance: request.url,
          requestId: request.id,
        }),
      );
      return;
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || user.status !== "active") {
      sendProblem(
        reply,
        createProblem({
          code: "forbidden",
          detail: "Account is not active.",
          instance: request.url,
          requestId: request.id,
        }),
      );
      return;
    }

    // Rotate: revoke old, issue new
    await prisma.authSession.update({
      where: { id: matchedSession.id },
      data: { revoked_at: new Date() },
    });

    const newAccessToken = signAccessToken(app, user);
    const newRefreshToken = signRefreshToken(app, user.id);

    const newRefreshTokenHash = await hash(newRefreshToken);
    await prisma.authSession.create({
      data: {
        user_id: user.id,
        refresh_token_hash: newRefreshTokenHash,
        rotated_from_id: matchedSession.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    reply.setCookie(REFRESH_COOKIE_NAME, newRefreshToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    reply.send({
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: 900,
    });
  });

  // ---------------------------------------------------------------------------
  // POST /v1/auth/logout
  // ---------------------------------------------------------------------------
  app.post(
    "/v1/auth/logout",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { sub } = (request as AuthenticatedRequest).user;
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME] as
        | string
        | undefined;

      const { prisma } = await import("@lingua/db");

      // Revoke all sessions for this user (or just the current one if we match)
      if (refreshToken) {
        const sessions = await prisma.authSession.findMany({
          where: { user_id: sub, revoked_at: null },
        });

        for (const session of sessions) {
          const matches = await verify(session.refresh_token_hash, refreshToken).catch(
            () => false,
          );
          if (matches) {
            await prisma.authSession.update({
              where: { id: session.id },
              data: { revoked_at: new Date() },
            });
            break;
          }
        }
      }

      // Clear the cookie
      reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
      reply.status(204).send();
    },
  );

  // ---------------------------------------------------------------------------
  // GET /v1/me
  // ---------------------------------------------------------------------------
  app.get(
    "/v1/me",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { sub } = (request as AuthenticatedRequest).user;

      const { prisma } = await import("@lingua/db");
      const user = await prisma.user.findUnique({
        where: { id: sub },
        include: {
          learner_profiles: {
            where: { is_active: true },
            include: {
              target_language: true,
              native_language: true,
            },
          },
          entitlements: {
            where: { status: "active" },
          },
        },
      });

      if (!user) {
        sendProblem(
          reply,
          createProblem({
            code: "not_found",
            detail: "User not found.",
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      reply.send({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        ui_locale: user.ui_locale,
        timezone: user.timezone,
        created_at: user.created_at,
        active_profile: user.learner_profiles[0] ?? null,
        entitlement: user.entitlements[0] ?? null,
      });
    },
  );
}
