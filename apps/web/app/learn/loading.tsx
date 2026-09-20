// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { CardSkeleton } from "@/components/skeletons";

/**
 * Onboarding loading fallback: mirrors the wizard's first step
 * so the layout does not jump when data arrives.
 */
export default function LearnLoading() {
  return (
    <div className="max-w-4xl" aria-busy="true" aria-label="Loading language choices">
      <div aria-hidden="true" className="h-6 w-56 rounded-full bg-line" />
      <div aria-hidden="true" className="mt-4 h-10 w-2/3 rounded-lg bg-line" />
      <div aria-hidden="true" className="mt-3 h-5 w-1/2 rounded-md bg-line" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
