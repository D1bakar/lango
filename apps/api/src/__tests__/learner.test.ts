// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { problemDetailsSchema } from "@lingua/types";
import { buildApp } from "../app";

describe("learner routes", () => {
  let app: FastifyInstance;
  let authToken: string;
  let enLanguageId: string;
  let esLanguageId: string;

  beforeAll(async () => {
    app = await buildApp({ logger: false });

    // Create a test user
    const email = `learner-test-${Date.now()}@example.com`;
    const signupResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/signup",
      payload: { email, password: "password123" },
    });
    const signupBody = signupResponse.json();
    authToken = signupBody.access_token;

    // Get language IDs
    const langResponse = await app.inject({ method: "GET", url: "/v1/languages" });
    const languages = langResponse.json();
    const en = languages.find((l: { tag: string }) => l.tag === "en");
    const es = languages.find((l: { tag: string }) => l.tag === "es");
    enLanguageId = en?.id ?? "";
    esLanguageId = es?.id ?? "";
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /v1/learner/languages", () => {
    it("creates a learner language profile", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/learner/languages",
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          target_language_id: esLanguageId,
          native_language_id: enLanguageId,
          cefr_self: "A1",
          goal: "travel",
          daily_minutes_target: 20,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBeTruthy();
      expect(body.target_language.tag).toBe("es");
      expect(body.native_language.tag).toBe("en");
      expect(body.cefr_self).toBe("A1");
      expect(body.goal).toBe("travel");
      expect(body.daily_minutes_target).toBe(20);
      expect(body.is_active).toBe(true);
    });

    it("rejects unauthenticated requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/learner/languages",
        payload: {
          target_language_id: esLanguageId,
          native_language_id: enLanguageId,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /v1/learner/languages", () => {
    it("lists all profiles for the user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/learner/languages",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe("PATCH /v1/learner/languages/:id", () => {
    it("updates a profile", async () => {
      // Get the profile ID
      const listResponse = await app.inject({
        method: "GET",
        url: "/v1/learner/languages",
        headers: { authorization: `Bearer ${authToken}` },
      });
      const profiles = listResponse.json();
      const profileId = profiles[0]?.id;

      if (!profileId) {
        throw new Error("No profile found to update");
      }

      const response = await app.inject({
        method: "PATCH",
        url: `/v1/learner/languages/${profileId}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          cefr_self: "A2",
          goal: "work",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.cefr_self).toBe("A2");
      expect(body.goal).toBe("work");
    });
  });
});
