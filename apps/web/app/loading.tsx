// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { PathGridSkeleton, StatsBandSkeleton } from "@/components/skeletons";

/**
 * Global loading fallback. The catalog reads from disk per request,
 * so first paint shows structure — never a blank page or spinner.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-16" aria-busy="true" aria-label="Loading page">
      <div>
        <div aria-hidden="true" className="h-6 w-40 rounded-full bg-line" />
        <div aria-hidden="true" className="mt-5 h-12 w-3/4 rounded-lg bg-line" />
        <div aria-hidden="true" className="mt-3 h-12 w-1/2 rounded-lg bg-line" />
      </div>
      <StatsBandSkeleton />
      <PathGridSkeleton />
    </div>
  );
}
