// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { LanguageSummary } from "@lingua/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiContractError,
  ApiUnavailableError,
  fetchLanguages,
  fetchPairs,
  fetchPairsByNative,
} from "./api";

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  });
  return calls;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const spanishSummary: LanguageSummary = {
  tag: "es",
  english_name: "Spanish",
  native_name: "Español",
  script: "Latn",
  direction: "ltr",
  packs_from: 0,
  packs_into: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLanguages", () => {
  it("returns validated languages", async () => {
    mockFetch(() => json([spanishSummary]));

    await expect(fetchLanguages()).resolves.toEqual([spanishSummary]);
  });

  it("reports an unreachable API as unavailable, not as a contract problem", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const error = await fetchLanguages().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiUnavailableError);
    // The message has to tell a developer what to actually do about it.
    expect((error as Error).message).toMatch(/pnpm --filter @lingua\/api dev/);
  });

  it("rejects a payload that does not match the contract", async () => {
    mockFetch(() => json([{ tag: "es", english_name: "Spanish" }]));

    await expect(fetchLanguages()).rejects.toBeInstanceOf(ApiContractError);
  });

  it("reports a non-2xx response as a contract problem", async () => {
    mockFetch(() => json({ code: "internal" }, 500));

    const error = await fetchLanguages().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiContractError);
    expect((error as Error).message).toMatch(/HTTP 500/);
  });
});

describe("fetchPairs", () => {
  it("encodes the language tag in the path", async () => {
    const calls = mockFetch(() => json([]));

    await fetchPairs("zh-Hans");

    expect(calls[0]).toContain("/v1/languages/zh-Hans/pairs");
  });
});

describe("fetchPairsByNative", () => {
  it("only requests origins that actually have packs", async () => {
    const calls = mockFetch(() => json([]));

    const result = await fetchPairsByNative([
      { ...spanishSummary, tag: "es", packs_from: 0 },
      { ...spanishSummary, tag: "en", english_name: "English", packs_from: 1, packs_into: 0 },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/v1/languages/en/pairs");
    expect(Object.keys(result)).toEqual(["en"]);
  });
});
