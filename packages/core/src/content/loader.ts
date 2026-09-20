// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  languageFileSchema,
  normalizationProfileSchema,
  packFileSchema,
  type LanguageFile,
  type LanguagePairSummary,
  type LanguageSummary,
  type NormalizationProfile,
  type PackFile,
  type PackSummary,
} from "@lingua/types";
import { parse as parseYaml } from "yaml";
import type { ZodType } from "zod";

/**
 * Reads `content/**` and validates it before anything uses it.
 *
 * This is the seam the pack import job (Phase 3.5) and the database read path
 * (Phase 3) both sit behind, so content is validated in exactly one place
 * whether it is served from disk or from Postgres.
 *
 * Validation never fails fast. Every problem in the content tree is reported
 * together, because an author who can only see one error per run is an author
 * who stops authoring.
 */

export class ContentLoadError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid content:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "ContentLoadError";
    this.problems = problems;
  }
}

export type LoadedContent = {
  root: string;
  languages: readonly LanguageFile[];
  normalizationProfiles: ReadonlyMap<string, NormalizationProfile>;
  packs: readonly PackFile[];
};

export type LoadContentOptions = {
  /** Override the content directory. Defaults to `$CONTENT_ROOT`, then a walk up to the repository root. */
  root?: string;
};

/**
 * Locate the `content/` directory.
 *
 * Walks up from this module rather than trusting the process working directory,
 * which differs between running from the repository root and from inside a
 * package.
 */
export function resolveContentRoot(startUrl: string = import.meta.url): string {
  const override = process.env.CONTENT_ROOT;
  if (override !== undefined && override.length > 0) {
    return path.resolve(override);
  }

  let dir = path.dirname(fileURLToPath(startUrl));
  for (;;) {
    if (
      existsSync(path.join(dir, "pnpm-workspace.yaml")) &&
      existsSync(path.join(dir, "content"))
    ) {
      return path.join(dir, "content");
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "Could not locate the repository root while looking for the content directory. " +
          "Set CONTENT_ROOT to point at it explicitly.",
      );
    }
    dir = parent;
  }
}

/** Always re-reads from disk. Use `getContent` in request paths. */
export async function loadContent(options: LoadContentOptions = {}): Promise<LoadedContent> {
  const root = options.root ?? resolveContentRoot();
  const problems: string[] = [];

  const relative = (filePath: string): string =>
    path.relative(root, filePath).split(path.sep).join("/");

  const languages = (
    await Promise.all(
      (await listFiles(path.join(root, "languages"), "languages", problems)).map((file) =>
        readAndValidate(file, languageFileSchema, problems, relative),
      ),
    )
  ).filter(isDefined);

  const normalizationProfiles = (
    await Promise.all(
      (await listFiles(path.join(root, "normalization"), "normalization", problems)).map((file) =>
        readAndValidate(file, normalizationProfileSchema, problems, relative),
      ),
    )
  ).filter(isDefined);

  const packs = (
    await Promise.all(
      (await listPackFiles(root, problems)).map((file) =>
        readAndValidate(file, packFileSchema, problems, relative),
      ),
    )
  ).filter(isDefined);

  crossValidate({ languages, normalizationProfiles, packs }, problems);

  if (problems.length > 0) {
    throw new ContentLoadError(problems);
  }

  return {
    root,
    languages,
    normalizationProfiles: new Map(
      normalizationProfiles.map((profile) => [profile.profile, profile]),
    ),
    packs,
  };
}

let cached: LoadedContent | undefined;

/**
 * Cached content read.
 *
 * Cached in production only. In development the cache is bypassed so editing a
 * YAML file takes effect on the next request: content is not imported as a
 * module, so no file watcher picks the change up.
 */
export async function getContent(options: LoadContentOptions = {}): Promise<LoadedContent> {
  const cacheable = options.root === undefined && process.env.NODE_ENV !== "development";
  if (cacheable && cached !== undefined) {
    return cached;
  }

  const loaded = await loadContent(options);
  if (cacheable) {
    cached = loaded;
  }
  return loaded;
}

/** Test-only escape hatch. */
export function resetContentCache(): void {
  cached = undefined;
}

// ---------------------------------------------------------------------------
// Views for the catalog API
// ---------------------------------------------------------------------------

/**
 * `packs_from` counts the paths a learner can start, using this as their native
 * language. `packs_into` counts packs that teach it. Both are derived from the
 * content tree rather than from a database count, so they are correct before a
 * single learner exists.
 */
export function toLanguageSummaries(content: LoadedContent): LanguageSummary[] {
  return content.languages
    .map((language) => ({
      tag: language.tag,
      english_name: language.english_name,
      native_name: language.native_name,
      script: language.script,
      direction: language.text_direction,
      packs_from: content.packs.filter((pack) => pack.native_language === language.tag).length,
      packs_into: content.packs.filter((pack) => pack.target_language === language.tag).length,
    }))
    .sort((a, b) => {
      const byCoverage = b.packs_into + b.packs_from - (a.packs_into + a.packs_from);
      return byCoverage !== 0 ? byCoverage : a.english_name.localeCompare(b.english_name);
    });
}

export function toPackSummary(pack: PackFile): PackSummary {
  return {
    pack_key: pack.pack_key,
    title: pack.title,
    description: pack.description.trim(),
    cefr_from: pack.cefr_from,
    cefr_to: pack.cefr_to,
    estimated_minutes: pack.estimated_minutes,
    version: pack.version,
    license: pack.license,
    status: pack.status,
  };
}

/** Target languages reachable from a given native language, with their packs. */
export function toLanguagePairs(content: LoadedContent, nativeTag: string): LanguagePairSummary[] {
  const byTarget = new Map<string, PackFile[]>();
  for (const pack of content.packs) {
    if (pack.native_language !== nativeTag) {
      continue;
    }
    const existing = byTarget.get(pack.target_language);
    if (existing === undefined) {
      byTarget.set(pack.target_language, [pack]);
    } else {
      existing.push(pack);
    }
  }

  const pairs: LanguagePairSummary[] = [];
  for (const [targetTag, packs] of byTarget) {
    const target = content.languages.find((language) => language.tag === targetTag);
    if (target === undefined) {
      // Cross-validation already reports this; skipping keeps the read path total.
      continue;
    }
    pairs.push({
      native_tag: nativeTag,
      target: {
        tag: target.tag,
        english_name: target.english_name,
        native_name: target.native_name,
        script: target.script,
        direction: target.text_direction,
      },
      packs: packs.map(toPackSummary).sort((a, b) => a.cefr_from.localeCompare(b.cefr_from)),
    });
  }

  return pairs.sort((a, b) => a.target.english_name.localeCompare(b.target.english_name));
}

// ---------------------------------------------------------------------------
// Cross-file validation
// ---------------------------------------------------------------------------

type Candidates = {
  languages: LanguageFile[];
  normalizationProfiles: NormalizationProfile[];
  packs: PackFile[];
};

/**
 * Checks no single schema can make: references between files, duplicate keys,
 * and a pack key agreeing with the languages it claims to connect.
 */
function crossValidate(content: Candidates, problems: string[]): void {
  const knownTags = new Set(content.languages.map((language) => language.tag));

  for (const tag of duplicates(content.languages.map((language) => language.tag))) {
    problems.push(`languages: duplicate language tag "${tag}".`);
  }

  const knownProfiles = new Set(content.normalizationProfiles.map((profile) => profile.profile));

  for (const profile of duplicates(content.normalizationProfiles.map((entry) => entry.profile))) {
    problems.push(`normalization: duplicate profile "${profile}".`);
  }

  for (const language of content.languages) {
    if (!knownProfiles.has(language.normalization_profile)) {
      problems.push(
        `languages/${language.tag}.yaml: normalization_profile "${language.normalization_profile}" has no file in normalization/.`,
      );
    }
  }

  for (const packKey of duplicates(content.packs.map((pack) => pack.pack_key))) {
    problems.push(`packs: duplicate pack key "${packKey}".`);
  }

  for (const pack of content.packs) {
    if (!knownTags.has(pack.native_language)) {
      problems.push(
        `packs/${pack.pack_key}: native_language "${pack.native_language}" is not a known language.`,
      );
    }
    if (!knownTags.has(pack.target_language)) {
      problems.push(
        `packs/${pack.pack_key}: target_language "${pack.target_language}" is not a known language.`,
      );
    }
    if (pack.native_language === pack.target_language) {
      problems.push(`packs/${pack.pack_key}: native and target language are the same.`);
    }

    // The key must agree with the declared languages, or a pack can live in one
    // directory and teach something else entirely.
    const expectedPrefix = `${pack.native_language}--${pack.target_language}-`;
    if (!pack.pack_key.startsWith(expectedPrefix)) {
      problems.push(
        `packs/${pack.pack_key}: pack_key must start with "${expectedPrefix}" to match its languages.`,
      );
    }

    if (ladderIndex(pack.cefr_from) > ladderIndex(pack.cefr_to)) {
      problems.push(
        `packs/${pack.pack_key}: cefr_from "${pack.cefr_from}" is above cefr_to "${pack.cefr_to}".`,
      );
    }

    // Publishing without a fluent reviewer is the exact failure mode the review
    // process exists to prevent. See MAINTAINERS.md.
    if (pack.status === "published" && pack.review.status !== "published") {
      problems.push(
        `packs/${pack.pack_key}: status is "published" but review.status is "${pack.review.status}".`,
      );
    }
    if (
      pack.review.status === "published" &&
      !pack.review.reviewers.some((reviewer) => reviewer.role === "native_speaker")
    ) {
      problems.push(
        `packs/${pack.pack_key}: cannot be reviewed as published without a native_speaker reviewer.`,
      );
    }
  }
}

const CEFR_LADDER = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];

function ladderIndex(level: string): number {
  const index = CEFR_LADDER.indexOf(level);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function duplicates(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      repeated.add(key);
    }
    seen.add(key);
  }
  return [...repeated];
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/** Read every `.yaml` file directly inside a content subdirectory. */
async function listFiles(dir: string, label: string, problems: string[]): Promise<string[]> {
  if (!existsSync(dir)) {
    problems.push(
      `Missing ${label}/ directory. Content must contain languages/, normalization/, and packs/.`,
    );
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

/**
 * Packs live at exactly `packs/{native}--{target}/{cefr}/pack.yaml`.
 *
 * The traversal is fixed-depth rather than a recursive glob so that a pack
 * dropped at the wrong depth is reported instead of silently ignored.
 */
async function listPackFiles(root: string, problems: string[]): Promise<string[]> {
  const packsDir = path.join(root, "packs");
  if (!existsSync(packsDir)) {
    problems.push(
      "Missing packs/ directory. Content must contain languages/, normalization/, and packs/.",
    );
    return [];
  }

  const found: string[] = [];
  for (const pairEntry of await readdir(packsDir, { withFileTypes: true })) {
    if (!pairEntry.isDirectory()) {
      continue;
    }
    const pairDir = path.join(packsDir, pairEntry.name);
    let packsInPair = 0;

    for (const levelEntry of await readdir(pairDir, { withFileTypes: true })) {
      if (!levelEntry.isDirectory()) {
        continue;
      }
      const packPath = path.join(pairDir, levelEntry.name, "pack.yaml");
      if (existsSync(packPath)) {
        found.push(packPath);
        packsInPair += 1;
      }
    }

    if (packsInPair === 0) {
      problems.push(
        `packs/${pairEntry.name}/: no pack.yaml found. Packs belong at packs/{native}--{target}/{cefr}/pack.yaml.`,
      );
    }
  }

  // A content tree with languages but no curriculum is almost always a mistake
  // rather than an intentional state, and it is invisible until someone tries to
  // learn something.
  if (found.length === 0) {
    problems.push(
      "packs/: no pack.yaml found anywhere. Expected packs/{native}--{target}/{cefr}/pack.yaml.",
    );
  }

  return found.sort();
}

async function readAndValidate<T>(
  filePath: string,
  schema: ZodType<T>,
  problems: string[],
  relative: (filePath: string) => string,
): Promise<T | undefined> {
  let raw: unknown;
  try {
    raw = parseYaml(await readFile(filePath, "utf8"));
  } catch (error) {
    problems.push(`${relative(filePath)}: not readable as YAML (${describe(error)}).`);
    return undefined;
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path.map(String).join(".") || "(root)";
      problems.push(`${relative(filePath)}: ${field}: ${issue.message}`);
    }
    return undefined;
  }

  return result.data;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unknown error";
}
