// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { describe, expect, it } from "vitest";
import { correctionSchema, learnerContextSchema, tutorStreamEventSchema } from "./ai";

const validCorrection = {
  id: "c1",
  span: { start: 3, end: 7 },
  original: "soy cansado",
  corrected: "estoy cansado",
  category: "grammar_agreement",
  subcategory_key: "ser_vs_estar",
  concept_key: "es.ser_vs_estar.present",
  explanation: "Use estar for a temporary state.",
  explanation_language: "en",
  severity: 3,
  is_meaning_changing: true,
  example: { target: "Estoy cansado.", native: "I am tired." },
  surface: "inline",
  grounded_in: "es.ser_vs_estar.present",
  is_ungrounded: false,
};

describe("correctionSchema", () => {
  it("accepts a grounded correction", () => {
    expect(correctionSchema.safeParse(validCorrection).success).toBe(true);
  });

  it("requires the explanation language to be explicit", () => {
    const { explanation_language: _omitted, ...withoutLanguage } = validCorrection;
    expect(correctionSchema.safeParse(withoutLanguage).success).toBe(false);
  });

  it("restricts severity to 1..3", () => {
    expect(correctionSchema.safeParse({ ...validCorrection, severity: 0 }).success).toBe(false);
    expect(correctionSchema.safeParse({ ...validCorrection, severity: 4 }).success).toBe(false);
  });

  it("rejects a category outside the closed taxonomy", () => {
    expect(correctionSchema.safeParse({ ...validCorrection, category: "vibes" }).success).toBe(
      false,
    );
  });

  it("requires is_ungrounded to be present so the UI can suppress uncited rules", () => {
    const { is_ungrounded: _omitted, ...withoutFlag } = validCorrection;
    expect(correctionSchema.safeParse(withoutFlag).success).toBe(false);
  });
});

describe("tutorStreamEventSchema", () => {
  it("parses each declared event", () => {
    const events = [
      {
        event: "turn_start",
        turn_id: "018f5c1e-6c9a-7d3b-9f2a-1b2c3d4e5f60",
        model_id: "m",
        prompt_version: "lesson_coach.v3",
      },
      { event: "transcript", text: "soy cansado", confidence: 0.91 },
      { event: "token", text: "Casi." },
      { event: "usage", voice_seconds_remaining: 420, tokens_in: 2100, tokens_out: 90 },
      { event: "audio_ready", url: "https://cdn/audio/abc", duration_ms: 1840, voice_id: "v1" },
      {
        event: "error",
        code: "transcription_low_confidence",
        message: "Could not hear that clearly.",
        retryable: true,
        fallback_available: true,
      },
    ];

    for (const event of events) {
      const parsed = tutorStreamEventSchema.safeParse(event);
      expect(parsed.success, `event ${event.event} should parse`).toBe(true);
    }
  });

  it("rejects an undeclared event name", () => {
    expect(tutorStreamEventSchema.safeParse({ event: "thinking", text: "..." }).success).toBe(
      false,
    );
  });

  it("requires a confidence value with a transcript", () => {
    expect(tutorStreamEventSchema.safeParse({ event: "transcript", text: "hola" }).success).toBe(
      false,
    );
  });
});

describe("learnerContextSchema", () => {
  const validContext = {
    context_version: "1",
    language: {
      target: { tag: "es", name: "Spanish", script: "Latn", direction: "ltr" },
      native: { tag: "en", name: "English" },
      pair_key: "en->es",
      transliteration_required: false,
    },
    learner: {
      cefr_ceiling: "A1",
      cefr_self: "A1",
      cefr_assessed: null,
      goal: { type: "travel", note: null },
      streak_days: 4,
      minutes_last_7d: 96,
      preferred_register: "neutral",
    },
    session: {
      mode: "lesson_coach",
      lesson: {
        id: "018f5c1e-6c9a-7d3b-9f2a-1b2c3d4e5f60",
        title: "Saying hello",
        unit_title: "Greetings and basics",
        objectives: ["Greet someone at the right time of day"],
        mentor_brief: "Stay within greetings vocabulary.",
      },
      scenario_key: null,
      turn_index: 3,
      max_turns: 12,
    },
    curriculum: {
      concepts_in_focus: [
        {
          key: "es.ser_vs_estar.present",
          kind: "grammar",
          cefr: "A1",
          title: "ser vs estar",
          authored_explanation: "Both mean to be...",
          examples: [{ target: "Estoy cansado.", native: "I am tired." }],
          common_errors: ["soy cansado"],
        },
      ],
      prerequisites: [{ key: "es.subject_pronouns", title: "Subject pronouns", mastered: true }],
      allowed_vocabulary: { core: ["hola", "buenos días"], newly_introduced: ["buenas noches"] },
      forbidden_structures: ["subjunctive", "past_tense"],
    },
    learner_model: {
      concept_mastery: [
        {
          key: "es.greetings.basic",
          state: "review",
          stability: 3.2,
          accuracy: 0.8,
          last_seen_days_ago: 2,
        },
      ],
      weak_concepts: [
        {
          key: "es.ser_vs_estar.present",
          recent_error_count: 4,
          dominant_category: "grammar_agreement",
        },
      ],
      recent_errors: [
        {
          category: "grammar_agreement",
          subcategory_key: "ser_vs_estar",
          original: "soy cansado",
          corrected: "estoy cansado",
          concept_key: "es.ser_vs_estar.present",
          days_ago: 0,
        },
      ],
      recurring_error_categories: ["grammar_agreement"],
      due_review: [{ key: "es.greetings.basic", kind: "concept" }],
      known_vocabulary_sample: ["hola", "gracias"],
    },
    policy: {
      max_new_vocab_per_turn: 2,
      correction_style: "inline_minimal",
      correction_density: "moderate",
      explain_on_request: true,
      use_native_language: "for_explanations",
      max_reply_sentences: 3,
    },
  };

  it("parses a complete context", () => {
    expect(learnerContextSchema.safeParse(validContext).success).toBe(true);
  });

  it("rejects an unknown context version so stale builders fail loudly", () => {
    expect(learnerContextSchema.safeParse({ ...validContext, context_version: "2" }).success).toBe(
      false,
    );
  });

  it("validates the pair key shape", () => {
    const context = {
      ...validContext,
      language: { ...validContext.language, pair_key: "en-es" },
    };
    expect(learnerContextSchema.safeParse(context).success).toBe(false);
  });

  it("requires the policy block, so no turn runs without declared constraints", () => {
    const { policy: _omitted, ...withoutPolicy } = validContext;
    expect(learnerContextSchema.safeParse(withoutPolicy).success).toBe(false);
  });
});
