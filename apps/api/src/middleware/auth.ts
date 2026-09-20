// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * Auth middleware.
 *
 * Provides JWT access-token verification and a `requireAuth` decorator that
 * attaches the authenticated user to the request. Tokens are short-lived
 * (15 min) access tokens; refresh uses httpOnly cookies managed by the auth
 * routes.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/** The claims we store in the access token. */
export type AccessTokenClaims = {
  sub: string; // user id
  email: string;
  role: string;
};

/** Augmented request type with the authenticated user. */
export type AuthenticatedRequest = FastifyRequest & {
  user: AccessTokenClaims;
};

/**
 * Verify the Authorization header and attach claims to the request.
 *
 * Throws a 401 if the token is missing, expired, or invalid.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (header === undefined || !header.startsWith("Bearer ")) {
    reply.status(401).send({
      type: "https://lingua.dev/problems/unauthenticated",
      title: "Unauthenticated",
      status: 401,
      detail: "Missing or malformed Authorization header.",
      instance: request.url,
      code: "unauthenticated",
      request_id: request.id,
    });
    return;
  }

  const token = header.slice(7);
  if (token.length === 0) {
    reply.status(401).send({
      type: "https://lingua.dev/problems/unauthenticated",
      title: "Unauthenticated",
      status: 401,
      detail: "Empty bearer token.",
      instance: request.url,
      code: "unauthenticated",
      request_id: request.id,
    });
    return;
  }

  try {
    const decoded = await request.server.jwt.verify<AccessTokenClaims>(token);
    (request as AuthenticatedRequest).user = decoded;
  } catch {
    reply.status(401).send({
      type: "https://lingua.dev/problems/token_expired",
      title: "Token expired",
      status: 401,
      detail: "The access token is invalid or has expired. Please refresh.",
      instance: request.url,
      code: "token_expired",
      request_id: request.id,
    });
  }
}

/**
 * Sign an access token for the given user.
 */
export function signAccessToken(
  app: FastifyInstance,
  user: { id: string; email: string; role: string },
): string {
  return app.jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    { expiresIn: "15m" },
  );
}

/**
 * Sign a refresh token (longer-lived, stored as httpOnly cookie).
 */
export function signRefreshToken(
  app: FastifyInstance,
  userId: string,
): string {
  return app.jwt.sign({ sub: userId }, { expiresIn: "7d" });
}
