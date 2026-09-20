// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { describe, expect, it } from "vitest";
import { conceptKeySchema, exerciseSchema, lessonItemSchema } from "./curriculum";

describe("conceptKeySchema", () => {
  it("accepts namespaced keys", () => {
    for (const key of ["es.ser_vs_estar.present", "ja.particles.wa_vs_ga", "fr.articles"]) {
      expect(conceptKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it("rejects keys without a language namespace", () => {
    expect(conceptKeySchema.safeParse("greetings.basic").success).toBe(false);
  });
});

describe("exerciseSchema", () => {
  it("accepts a well-formed multiple choice exercise", () => {
    const parsed = exerciseSchema.safeParse({
      type: "mcq",
      payload: {
        options: [
          { id: "a", text: "Buenos días" },
          { id: "b", text: "Buenas noches" },
        ],
      },
      answer_spec: { correct: ["a"] },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a multiple choice exercise with two correct answers", () => {
    const parsed = exerciseSchema.safeParse({
      type: "mcq",
      payload: {
        options: [
          { id: "a", text: "Buenos días" },
          { id: "b", text: "Buenas noches" },
        ],
      },
      answer_spec: { correct: ["a", "b"] },
    });
    expect(parsed.success).toBe(false);
  });

  it("requires at least one accepted answer for free text", () => {
    expect(
      exerciseSchema.safeParse({
        type: "type_answer",
        payload: {},
        answer_spec: { accepted_answers: [] },
      }).success,
    ).toBe(false);
  });

  it("applies defaults for free text", () => {
    const parsed = exerciseSchema.parse({
      type: "type_answer",
      payload: {},
      answer_spec: { accepted_answers: ["Buenas noches"] },
    });
    if (parsed.type !== "type_answer") {
      throw new Error(`expected type_answer, received ${parsed.type}`);
    }
    expect(parsed.payload.max_length).toBe(120);
    expect(parsed.answer_spec.alternatives).toEqual([]);
  });

  it("defaults the speech confidence floor that decides repeat-versus-mistake", () => {
    const parsed = exerciseSchema.parse({
      type: "speak_repeat",
      payload: { target_text: "Buenos días", transliteration: null },
      answer_spec: { expected_transcript: "buenos días" },
    });
    if (parsed.type !== "speak_repeat") {
      throw new Error(`expected speak_repeat, received ${parsed.type}`);
    }
    expect(parsed.answer_spec.min_confidence).toBe(0.6);
  });

  it("rejects an undeclared exercise type", () => {
    expect(
      exerciseSchema.safeParse({ type: "telepathy", payload: {}, answer_spec: {} }).success,
    ).toBe(false);
  });
});

describe("lessonItemSchema", () => {
  it("never carries the answer key or the explanation", () => {
    // The security guarantee from docs/architecture/03-api-contracts.md: a client
    // that can read the answer key makes the whole progress system worthless.
    const parsed = lessonItemSchema.parse({
      exercise_id: "018f5c1e-6c9a-7d3b-9f2a-1b2c3d4e5f60",
      exercise_revision: 1,
      order_index: 0,
      exercise_type: "mcq",
      prompt_md: "It's 9am. Which greeting fits?",
      payload: { options: [] },
      prompt_audio_url: null,
      difficulty: 1,
      answer_spec: { correct: ["a"] },
      explanation_md: "Buenos días is used until midday.",
    });

    expect("answer_spec" in parsed).toBe(false);
    expect("explanation_md" in parsed).toBe(false);
  });
});
