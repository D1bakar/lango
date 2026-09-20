// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * @lingua/types — the shared vocabulary.
 *
 * This package sits at the leaf of the dependency graph and imports nothing else
 * from the repository. Every contract in docs/architecture is expressed here
 * once; the API validates with these schemas, the web client infers its types
 * from them, and the content validator uses them to check language packs.
 *
 * Schemas are the source of truth. Types are derived with `z.infer` and must
 * never be hand-written in parallel.
 */

export * from "./primitives";
export * from "./language";
export * from "./curriculum";
export * from "./content";
export * from "./learner";
export * from "./ai";
export * from "./api";
