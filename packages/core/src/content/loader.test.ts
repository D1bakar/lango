// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ContentLoadError,
  loadContent,
  resolveContentRoot,
  toLanguagePairs,
  toLanguageSummaries,
  toPackSummary,
} from "./loader";

describe("resolveContentRoot", () => {
  it("finds the repository content directory without trusting the working directory", () => {
    const root = resolveContentRoot();

    expect(path.basename(root)).toBe("content");
    expect(existsSync(path.join(path.dirname(root), "pnpm-workspace.yaml"))).toBe(true);
  });
});

describe("loadContent against the seeded content", () => {
  it("loads and validates every language, normalization profile, and pack", async () => {
    const content = await loadContent();

    expect(content.languages.map((language) => language.tag).sort()).toEqual(["en", "es"]);
    expect([...content.normalizationProfiles.keys()].sort()).toEqual(["en", "es"]);
    expect(content.packs.map((pack) => pack.pack_key)).toEqual(["en--es-a1"]);
  });

  it("applies declared defaults rather than requiring them in every file", async () => {
    const content = await loadContent();
    const english = content.languages.find((language) => language.tag === "en");

    expect(english?.transliteration_required).toBe(false);
    expect(english?.tokenizer_profile).toBe("whitespace");
  });

  it("keeps Spanish grading strict about accents", async () => {
    const content = await loadContent();
    const spanish = content.normalizationProfiles.get("es");

    // Accepting "esta" for "está" would teach a wrong habit. See ADR-0008.
    expect(spanish?.rules.diacritics).toBe("required");
    expect(spanish?.rules.accept_missing_opening_marks).toBe(true);
  });

  it("keeps the seeded pack honest about its review state", async () => {
    const content = await loadContent();
    const pack = content.packs[0];

    // A pack that is published without a fluent reviewer is the failure the
    // loader's cross-validation refuses to let through.
    expect(pack?.status).toBe("draft");
    expect(pack?.review.status).toBe("draft");
  });

  it("derives path counts from the content tree, in both directions", async () => {
    const summaries = toLanguageSummaries(await loadContent());

    const english = summaries.find((summary) => summary.tag === "en");
    const spanish = summaries.find((summary) => summary.tag === "es");

    expect(english?.packs_from).toBe(1);
    expect(english?.packs_into).toBe(0);
    expect(spanish?.packs_into).toBe(1);
    expect(spanish?.packs_from).toBe(0);
  });

  it("resolves the pairs reachable from English", async () => {
    const pairs = toLanguagePairs(await loadContent(), "en");

    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.target.tag).toBe("es");
    expect(pairs[0]?.packs[0]?.cefr_from).toBe("A1");
  });

  it("offers no pairs for a language with no packs", async () => {
    expect(toLanguagePairs(await loadContent(), "es")).toEqual([]);
  });

  it("summarizes a pack without the authoring-only fields", async () => {
    const pack = (await loadContent()).packs[0];
    expect(pack).toBeDefined();
    if (pack === undefined) {
      return;
    }

    const summary = toPackSummary(pack);
    expect(summary.pack_key).toBe("en--es-a1");
    expect(summary.license).toBe("CC-BY-NC-4.0");
    expect("migrations" in summary).toBe(false);
    expect("review" in summary).toBe(false);
  });
});

describe("loadContent against invalid content", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "lingua-content-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function write(relativePath: string, contents: string): Promise<void> {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
  }

  function languageFile(tag: string, normalizationProfile: string): string {
    return [
      "schema_version: 1",
      `tag: ${tag}`,
      `english_name: ${tag}`,
      `native_name: ${tag}`,
      "script: Latn",
      "text_direction: ltr",
      `normalization_profile: ${normalizationProfile}`,
    ].join("\n");
  }

  function normalizationFile(profile: string): string {
    return ["schema_version: 1", `profile: ${profile}`, "rules: {}"].join("\n");
  }

  function packFile(nativeTag: string, targetTag: string): string {
    return [
      "schema_version: 1",
      `pack_key: ${nativeTag}--${targetTag}-a1`,
      `native_language: ${nativeTag}`,
      `target_language: ${targetTag}`,
      "cefr_from: A1",
      "cefr_to: A1",
      "title: Test pack",
      "description: A pack used by the loader tests.",
      "estimated_minutes: 60",
      "version: 1.0.0",
      "license: CC-BY-NC-4.0",
      "status: draft",
      "review:",
      "  status: draft",
    ].join("\n");
  }

  it("reports a language whose normalization profile does not exist", async () => {
    await write("languages/es.yaml", languageFile("es", "missing-profile"));
    await write("normalization/en.yaml", normalizationFile("en"));
    await mkdir(path.join(root, "packs"), { recursive: true });

    await expect(loadContent({ root })).rejects.toThrow(
      /normalization_profile "missing-profile" has no file in normalization\//,
    );
  });

  it("reports a pack that references an unknown language", async () => {
    await write("languages/en.yaml", languageFile("en", "en"));
    await write("normalization/en.yaml", normalizationFile("en"));
    await write("packs/en--de/a1/pack.yaml", packFile("en", "de"));

    await expect(loadContent({ root })).rejects.toThrow(
      /target_language "de" is not a known language/,
    );
  });

  it("reports a pack key that disagrees with its declared languages", async () => {
    await write("languages/en.yaml", languageFile("en", "en"));
    await write("normalization/en.yaml", normalizationFile("en"));
    await write(
      "packs/en--es/a1/pack.yaml",
      packFile("en", "es").replace("pack_key: en--es-a1", "pack_key: en--fr-a1"),
    );

    await expect(loadContent({ root })).rejects.toThrow(/pack_key must start with "en--es-"/);
  });

  it("reports a pack dropped at the wrong depth", async () => {
    await write("languages/en.yaml", languageFile("en", "en"));
    await write("normalization/en.yaml", normalizationFile("en"));
    await write("packs/en--es/pack.yaml", packFile("en", "es"));

    await expect(loadContent({ root })).rejects.toThrow(/no pack\.yaml found/);
  });

  it("refuses to treat a pack as reviewed without a native speaker reviewer", async () => {
    await write("languages/en.yaml", languageFile("en", "en"));
    await write("normalization/en.yaml", normalizationFile("en"));
    await write(
      "packs/en--es/a1/pack.yaml",
      packFile("en", "es")
        .replace("status: draft", "status: published")
        .replace("  status: draft", "  status: published"),
    );

    await expect(loadContent({ root })).rejects.toThrow(/without a native_speaker reviewer/);
  });

  it("collects every problem instead of stopping at the first", async () => {
    await write("languages/en.yaml", languageFile("en", "nope"));
    await mkdir(path.join(root, "normalization"), { recursive: true });
    await mkdir(path.join(root, "packs"), { recursive: true });

    const error = await loadContent({ root }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ContentLoadError);
    const problems = (error as ContentLoadError).problems;
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toMatch(/normalization_profile "nope"/);
  });

  it("surfaces a schema failure with the field path and the file", async () => {
    await write(
      "languages/es.yaml",
      languageFile("es", "es").replace("script: Latn", "script: latn"),
    );
    await write("normalization/es.yaml", normalizationFile("es"));
    await mkdir(path.join(root, "packs"), { recursive: true });

    const error = await loadContent({ root }).catch((caught: unknown) => caught);
    const problems = (error as ContentLoadError).problems.join("\n");

    expect(problems).toMatch(/languages\/es\.yaml/);
    expect(problems).toMatch(/script:/);
    expect(problems).toMatch(/ISO 15924/);
  });
});
