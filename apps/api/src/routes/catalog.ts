// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { FastifyInstance } from "fastify";
import { getContent, toLanguagePairs, toLanguageSummaries } from "@lingua/core";
import type { ContentLoadStatus } from "@lingua/types";
import { createProblem, sendProblem } from "../problem";

/**
 * Catalog reads.
 *
 * Content-backed rather than database-backed at this stage. The read path goes
 * through @lingua/core, which is the same seam the database read will sit behind
 * in Phase 3, so swapping the source is a change in one place.
 *
 * Bounded lists return a bare array; learner-scoped and unbounded lists use the
 * paginated envelope. See docs/architecture/03-api-contracts.md.
 */
export async function registerCatalogRoutes(app: FastifyInstance): Promise<void> {
  /** Every known language, with how many packs start from it and teach it. */
  app.get("/v1/languages", async () => {
    const content = await getContent();
    return toLanguageSummaries(content);
  });

  /** Targets reachable from a native language, with the packs available for each. */
  app.get<{ Params: { tag: string } }>(
    "/v1/languages/:tag/pairs",
    {
      schema: {
        params: {
          type: "object",
          required: ["tag"],
          properties: {
            tag: {
              type: "string",
              pattern: "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { tag } = request.params;
      const content = await getContent();

      if (!content.languages.some((language) => language.tag === tag)) {
        sendProblem(
          reply,
          createProblem({
            code: "not_found",
            detail: `Unknown language "${tag}".`,
            instance: request.url,
            requestId: request.id,
          }),
        );
        return;
      }

      return toLanguagePairs(content, tag);
    },
  );

  /** What content the running process actually loaded. Counts only. */
  app.get("/v1/content/status", async (): Promise<ContentLoadStatus> => {
    const content = await getContent();
    return {
      schema_version: 1,
      languages: content.languages.length,
      normalization_profiles: content.normalizationProfiles.size,
      packs: content.packs.length,
      packs_published: content.packs.filter((pack) => pack.status === "published").length,
    };
  });
}
