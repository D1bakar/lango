// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  contentLoadStatusSchema,
  languagePairSummarySchema,
  languageSummarySchema,
  problemDetailsSchema,
} from "@lingua/types";
import { buildApp } from "../app";

describe("catalog routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /v1/languages", () => {
    it("returns every language, each satisfying the contract", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/languages" });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);

      for (const language of body) {
        const parsed = languageSummarySchema.safeParse(language);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      }
    });

    it("reports which direction each language is useful in", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/languages" });
      const byTag = new Map(
        (response.json() as { tag: string }[]).map((language) => [language.tag, language]),
      );

      expect(byTag.get("en")).toMatchObject({ packs_from: 1, packs_into: 0 });
      expect(byTag.get("es")).toMatchObject({ packs_from: 0, packs_into: 1 });
    });
  });

  describe("GET /v1/languages/:tag/pairs", () => {
    it("lists the targets reachable from English", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/languages/en/pairs" });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(1);

      const parsed = languagePairSummarySchema.safeParse(body[0]);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(body[0].target.tag).toBe("es");
      expect(body[0].packs[0].pack_key).toBe("en--es-a1");
    });

    it("returns an empty list, not an error, when a language teaches nothing", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/languages/es/pairs" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it("returns a problem document for an unknown language", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/languages/xx/pairs" });

      expect(response.statusCode).toBe(404);
      const parsed = problemDetailsSchema.safeParse(response.json());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe("not_found");
      }
    });

    it("rejects a malformed tag before the handler runs", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/languages/NOT-A-TAG/pairs" });

      expect(response.statusCode).toBe(422);
      const parsed = problemDetailsSchema.safeParse(response.json());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe("validation_failed");
      }
    });
  });

  describe("GET /v1/content/status", () => {
    it("reports what content the process loaded, without leaking paths", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/content/status" });

      expect(response.statusCode).toBe(200);
      const parsed = contentLoadStatusSchema.safeParse(response.json());
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      if (!parsed.success) {
        return;
      }

      expect(parsed.data.languages).toBe(2);
      expect(parsed.data.packs).toBe(1);
      expect(parsed.data.packs_published).toBe(0);
      expect(response.body).not.toMatch(/[A-Za-z]:\\|\/Users\/|\/home\//);
    });
  });
});
