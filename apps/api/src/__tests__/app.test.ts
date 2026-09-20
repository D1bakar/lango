// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { problemDetailsSchema } from "@lingua/types";
import { buildApp } from "../app";

describe("API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });

    // Registered here to exercise the error handler. Real routes arrive in
    // Phase 3; this proves the validation contract without inventing a feature.
    app.post(
      "/__test/echo-name",
      {
        schema: {
          body: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
      },
      async (request) => request.body,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("reports healthy", async () => {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: "ok" });
    });

    it("returns a correlation id on every response", async () => {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.headers["x-request-id"]).toBeTruthy();
    });

    it("generates a fresh correlation id per request rather than trusting the caller", async () => {
      const first = await app.inject({
        method: "GET",
        url: "/health",
        headers: { "x-request-id": "caller-supplied" },
      });
      const second = await app.inject({
        method: "GET",
        url: "/health",
        headers: { "x-request-id": "caller-supplied" },
      });

      expect(first.headers["x-request-id"]).not.toBe("caller-supplied");
      expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
    });
  });

  describe("unknown routes", () => {
    it("returns a problem document that satisfies the shared contract", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/does-not-exist" });

      expect(response.statusCode).toBe(404);
      expect(response.headers["content-type"]).toContain("application/problem+json");

      const parsed = problemDetailsSchema.safeParse(response.json());
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      if (!parsed.success) {
        return;
      }
      expect(parsed.data.code).toBe("not_found");
      expect(parsed.data.status).toBe(404);
      expect(parsed.data.instance).toBe("/v1/does-not-exist");
      expect(parsed.data.request_id).toBeTruthy();
    });
  });

  describe("request validation", () => {
    it("returns 422 with field-level detail", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/__test/echo-name",
        payload: {},
      });

      expect(response.statusCode).toBe(422);
      expect(response.headers["content-type"]).toContain("application/problem+json");

      const parsed = problemDetailsSchema.safeParse(response.json());
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      if (!parsed.success) {
        return;
      }
      expect(parsed.data.code).toBe("validation_failed");
      expect(parsed.data.errors?.length).toBeGreaterThan(0);
    });

    it("accepts a valid body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/__test/echo-name",
        payload: { name: "Ada" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ name: "Ada" });
    });
  });

  describe("security headers", () => {
    it("sets helmet defaults", async () => {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["content-security-policy"]).toBeTruthy();
    });
  });
});
