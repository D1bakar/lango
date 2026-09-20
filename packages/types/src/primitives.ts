// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { z } from "zod";

/** Time-ordered UUID v7. Every primary key in the system uses this format. */
export const uuidSchema = z.uuid();
export type Uuid = z.infer<typeof uuidSchema>;

/**
 * ISO-8601 instant in UTC. Offsets are rejected on purpose: everything is stored
 * and transported in UTC, and presentation is the client's responsibility.
 */
export const isoDateTimeSchema = z.iso.datetime();
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

/** Calendar date in UTC, used by rollup tables such as `activity_day`. */
export const isoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof isoDateSchema>;

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

/**
 * Cursor pagination query. Offset pagination is never used: it is unbounded in
 * cost and unstable when rows change between requests.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  cursor: z.string().min(1).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Wrap an item schema in the standard cursor-paginated envelope. */
export function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    next_cursor: z.string().min(1).nullable(),
    has_more: z.boolean(),
  });
}

export type Paginated<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
};
