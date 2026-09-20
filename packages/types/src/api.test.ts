// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { describe, expect, it } from "vitest";
import {
  API_ERROR_CODES,
  ERROR_CODE_STATUS,
  TUTOR_STREAM_ERROR_CODES,
  apiErrorCodeSchema,
  problemDetailsSchema,
} from "./api";

describe("error code registry", () => {
  it("maps every HTTP error code to a 4xx or 5xx status", () => {
    for (const code of API_ERROR_CODES) {
      const status = ERROR_CODE_STATUS[code];
      expect(status, `missing status for ${code}`).toBeDefined();
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThanOrEqual(599);
    }
  });

  it("distinguishes running out of voice from going too fast", () => {
    expect(ERROR_CODE_STATUS.quota_exhausted).toBe(402);
    expect(ERROR_CODE_STATUS.rate_limited).toBe(429);
    expect(ERROR_CODE_STATUS.quota_exhausted).not.toBe(ERROR_CODE_STATUS.rate_limited);
  });

  it("keeps stream-only failures out of the HTTP registry", () => {
    expect(TUTOR_STREAM_ERROR_CODES).toContain("transcription_low_confidence");
    expect(API_ERROR_CODES).not.toContain("transcription_low_confidence");
  });

  it("rejects an unknown code", () => {
    expect(apiErrorCodeSchema.safeParse("something_broke").success).toBe(false);
  });
});

describe("problemDetailsSchema", () => {
  const validProblem = {
    type: "https://lingua.example/problems/quota",
    title: "Voice quota exhausted",
    status: 402,
    detail: "Your free voice practice for today is used up. Text practice is still open.",
    instance: "/v1/tutor/sessions/abc/voice-turns",
    code: "voice_quota_exhausted",
    request_id: "req_018f5c1e",
  };

  it("accepts an RFC 9457 problem", () => {
    expect(problemDetailsSchema.safeParse(validProblem).success).toBe(true);
  });

  it("requires a request id for correlation with logs", () => {
    const { request_id: _omitted, ...withoutRequestId } = validProblem;
    expect(problemDetailsSchema.safeParse(withoutRequestId).success).toBe(false);
  });

  it("carries field-level failures for validation errors", () => {
    const parsed = problemDetailsSchema.parse({
      ...validProblem,
      status: 422,
      code: "validation_failed",
      errors: [{ path: "email", message: "Invalid email address" }],
    });
    expect(parsed.errors).toHaveLength(1);
  });

  it("rejects a success status", () => {
    expect(problemDetailsSchema.safeParse({ ...validProblem, status: 200 }).success).toBe(false);
  });
});
