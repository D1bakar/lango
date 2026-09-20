// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * Status loading fallback: mirrors the stat-card grid
 * so the layout does not jump when live data arrives.
 */
export default function StatusLoading() {
  return (
    <div className="max-w-4xl" aria-busy="true" aria-label="Loading system status">
      <div aria-hidden="true" className="h-6 w-40 rounded-full bg-line" />
      <div aria-hidden="true" className="mt-4 h-10 w-48 rounded-lg bg-line" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            aria-hidden="true"
            className="rounded-2xl border border-line bg-surface px-5 py-4"
          >
            <div className="h-4 w-28 rounded-md bg-line" />
            <div className="mt-2 h-8 w-16 rounded-md bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
