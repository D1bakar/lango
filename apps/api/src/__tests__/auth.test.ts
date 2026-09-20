// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { problemDetailsSchema } from "@lingua/types";
import { buildApp } from "../app";

describe("auth routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /v1/auth/signup", () => {
    it("creates a new user and returns tokens", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: {
          email: `test-${Date.now()}@example.com`,
          password: "password123",
          display_name: "Test User",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.access_token).toBeTruthy();
      expect(body.token_type).toBe("Bearer");
      expect(body.expires_in).toBe(900);
      expect(body.user.email).toBeTruthy();
      expect(body.user.display_name).toBe("Test User");
      expect(body.user.role).toBe("learner");
    });

    it("rejects duplicate emails", async () => {
      const email = `dup-${Date.now()}@example.com`;

      // First signup succeeds
      await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: { email, password: "password123" },
      });

      // Second signup fails
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: { email, password: "password123" },
      });

      expect(response.statusCode).toBe(409);
      const parsed = problemDetailsSchema.safeParse(response.json());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe("email_taken");
      }
    });

    it("rejects short passwords", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: {
          email: `short-${Date.now()}@example.com`,
          password: "1234567", // 7 chars, minimum is 8
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  describe("POST /v1/auth/login", () => {
    it("returns tokens for valid credentials", async () => {
      const email = `login-${Date.now()}@example.com`;
      const password = "password123";

      // Create user first
      await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: { email, password },
      });

      // Login
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email, password },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.access_token).toBeTruthy();
      expect(body.user.email).toBe(email);
    });

    it("rejects invalid credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          email: `nonexistent-${Date.now()}@example.com`,
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
      const parsed = problemDetailsSchema.safeParse(response.json());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe("invalid_credentials");
      }
    });
  });

  describe("GET /v1/me", () => {
    it("returns the authenticated user", async () => {
      const email = `me-${Date.now()}@example.com`;

      // Signup
      const signupResponse = await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: { email, password: "password123" },
      });
      const { access_token } = signupResponse.json();

      // Get profile
      const response = await app.inject({
        method: "GET",
        url: "/v1/me",
        headers: { authorization: `Bearer ${access_token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.email).toBe(email);
      expect(body.role).toBe("learner");
    });

    it("rejects unauthenticated requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/me",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /v1/auth/logout", () => {
    it("revokes the session", async () => {
      const email = `logout-${Date.now()}@example.com`;

      // Signup
      const signupResponse = await app.inject({
        method: "POST",
        url: "/v1/auth/signup",
        payload: { email, password: "password123" },
      });
      const { access_token } = signupResponse.json();

      // Logout
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/logout",
        headers: { authorization: `Bearer ${access_token}` },
      });

      expect(response.statusCode).toBe(204);
    });
  });
});
