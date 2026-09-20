// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import {
  contentLoadStatusSchema,
  languagePairSummarySchema,
  languageSummarySchema,
  type ContentLoadStatus,
  type LanguagePairSummary,
  type LanguageSummary,
} from "@lingua/types";
import { z } from "zod";

/**
 * Server-side API client.
 *
 * Requests are made from the server, not the browser, so this works with no
 * cross-origin round trip and without exposing the API's address to clients.
 *
 * Every response is validated against the shared schema before it is used. A
 * contract drift between the API and this client then fails loudly at the edge
 * instead of rendering something subtly wrong.
 */

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

/** The API could not be reached at all. Almost always "the API is not running". */
export class ApiUnavailableError extends Error {
  constructor(path: string, cause: unknown) {
    super(
      `Could not reach the API at ${API_BASE_URL}${path}. Start it with \`pnpm --filter @lingua/api dev\`.`,
    );
    this.name = "ApiUnavailableError";
    this.cause = cause;
  }
}

/** The API answered, but not with what this client was written against. */
export class ApiContractError extends Error {
  constructor(path: string, detail: string) {
    super(`Unexpected response from ${path}: ${detail}`);
    this.name = "ApiContractError";
  }
}

async function getJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      // Content is served from disk and changes between requests during
      // development, so caching here would hide edits.
      cache: "no-store",
      headers: { accept: "application/json" },
    });
  } catch (error) {
    throw new ApiUnavailableError(path, error);
  }

  if (!response.ok) {
    throw new ApiContractError(path, `HTTP ${response.status}`);
  }

  return response.json();
}

function parse<T>(path: string, schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ApiContractError(path, detail);
  }
  return result.data;
}

export async function fetchLanguages(): Promise<LanguageSummary[]> {
  const path = "/v1/languages";
  return parse(path, z.array(languageSummarySchema), await getJson(path));
}

export async function fetchPairs(nativeTag: string): Promise<LanguagePairSummary[]> {
  const path = `/v1/languages/${encodeURIComponent(nativeTag)}/pairs`;
  return parse(path, z.array(languagePairSummarySchema), await getJson(path));
}

export async function fetchContentStatus(): Promise<ContentLoadStatus> {
  const path = "/v1/content/status";
  return parse(path, contentLoadStatusSchema, await getJson(path));
}

export type ApiHealth = { status: string; uptime_seconds: number };

const healthSchema = z.object({
  status: z.string().min(1),
  uptime_seconds: z.number().min(0),
});

export async function fetchHealth(): Promise<ApiHealth> {
  const path = "/health";
  return parse(path, healthSchema, await getJson(path));
}

/**
 * Pairs for every native language that has at least one pack, fetched once on
 * the server so the client wizard needs no network calls of its own.
 */
export async function fetchPairsByNative(
  languages: LanguageSummary[],
): Promise<Record<string, LanguagePairSummary[]>> {
  const originLanguages = languages.filter((language) => language.packs_from > 0);
  const entries = await Promise.all(
    originLanguages.map(
      async (language) => [language.tag, await fetchPairs(language.tag)] as const,
    ),
  );

  return Object.fromEntries(entries);
}
