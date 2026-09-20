// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * @lingua/core — domain logic.
 *
 * This package imports no web framework and no database client. Everything here
 * must be unit-testable without a server, a network, or a running Postgres.
 * See docs/architecture/01-system-architecture.md.
 */

export {
  ContentLoadError,
  getContent,
  loadContent,
  resetContentCache,
  resolveContentRoot,
  toLanguagePairs,
  toLanguageSummaries,
  toPackSummary,
} from "./content/loader";
export type { LoadContentOptions, LoadedContent } from "./content/loader";
