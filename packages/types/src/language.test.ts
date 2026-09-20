// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { describe, expect, it } from "vitest";
import {
  bcp47TagSchema,
  cefrLevelSchema,
  languageSchema,
  morphologySchema,
  normalizationProfileSchema,
  scriptSchema,
  textDirectionSchema,
} from "./language";

describe("cefrLevelSchema", () => {
  it("accepts the CEFR levels plus our A0 extension", () => {
    for (const level of ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]) {
      expect(cefrLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  it("rejects anything outside the scale", () => {
    expect(cefrLevelSchema.safeParse("Z9").success).toBe(false);
    expect(cefrLevelSchema.safeParse("b1").success).toBe(false);
  });
});

describe("bcp47TagSchema", () => {
  it("accepts plain and region/script subtagged tags", () => {
    for (const tag of ["es", "en", "pt-BR", "zh-Hans", "sr-Latn-RS"]) {
      expect(bcp47TagSchema.safeParse(tag).success).toBe(true);
    }
  });

  it("rejects uppercase primary subtags and single characters", () => {
    expect(bcp47TagSchema.safeParse("ES").success).toBe(false);
    expect(bcp47TagSchema.safeParse("e").success).toBe(false);
  });
});

describe("scriptSchema", () => {
  it("accepts ISO 15924 four-letter codes", () => {
    for (const script of ["Latn", "Cyrl", "Jpan", "Deva"]) {
      expect(scriptSchema.safeParse(script).success).toBe(true);
    }
  });

  it("rejects malformed codes", () => {
    expect(scriptSchema.safeParse("latn").success).toBe(false);
    expect(scriptSchema.safeParse("LATIN").success).toBe(false);
  });

  it("does not close the list of scripts", () => {
    // The format is validated, not a fixed enumeration: a new language pack must
    // never require a code change. See ADR-0008.
    expect(scriptSchema.safeParse("Zzzz").success).toBe(true);
  });
});

describe("textDirectionSchema", () => {
  it("is a closed enum because rendering branches on it", () => {
    expect(textDirectionSchema.safeParse("rtl").success).toBe(true);
    expect(textDirectionSchema.safeParse("diagonal").success).toBe(false);
  });
});

describe("morphologySchema", () => {
  it("fills every flag from an empty object", () => {
    const parsed = morphologySchema.parse({});
    expect(parsed.has_grammatical_gender).toBe(false);
    expect(parsed.genders).toEqual([]);
    expect(parsed.case_count).toBe(0);
  });

  it("keeps declared features", () => {
    const parsed = morphologySchema.parse({
      has_grammatical_gender: true,
      genders: ["masculine", "feminine"],
      has_diacritics: true,
    });
    expect(parsed.has_grammatical_gender).toBe(true);
    expect(parsed.genders).toHaveLength(2);
  });
});

describe("normalizationProfileSchema", () => {
  it("defaults to strict accents because that is correct for Spanish", () => {
    const parsed = normalizationProfileSchema.parse({
      schema_version: 1,
      profile: "es",
      rules: {},
    });
    expect(parsed.rules.diacritics).toBe("required");
    expect(parsed.rules.case_sensitive).toBe(false);
    expect(parsed.rules.script_folding).toEqual([]);
  });

  it("allows a language to relax accents, as Arabic and Japanese require", () => {
    const parsed = normalizationProfileSchema.parse({
      schema_version: 1,
      profile: "ar",
      rules: { diacritics: "ignore", width_normalization: true },
    });
    expect(parsed.rules.diacritics).toBe("ignore");
    expect(parsed.rules.width_normalization).toBe(true);
  });
});

describe("languageSchema", () => {
  const validLanguage = {
    id: "018f5c1e-6c9a-7d3b-9f2a-1b2c3d4e5f60",
    bcp47_tag: "es",
    english_name: "Spanish",
    native_name: "Español",
    script: "Latn",
    text_direction: "ltr",
    transliteration_scheme: null,
    transliteration_required: false,
    tokenizer_profile: "whitespace",
    normalization_profile: "es",
    morphology: {},
    is_active: true,
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
  };

  it("parses a complete language record", () => {
    const parsed = languageSchema.parse(validLanguage);
    expect(parsed.bcp47_tag).toBe("es");
    expect(parsed.morphology.has_diacritics).toBe(false);
  });

  it("requires an explicit text direction", () => {
    const { text_direction: _omitted, ...withoutDirection } = validLanguage;
    expect(languageSchema.safeParse(withoutDirection).success).toBe(false);
  });

  it("rejects a non-UTC timestamp", () => {
    expect(
      languageSchema.safeParse({ ...validLanguage, created_at: "2026-09-20T10:00:00+02:00" })
        .success,
    ).toBe(false);
  });
});
