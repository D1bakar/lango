// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * Loading placeholders. Shimmer uses the shared animate-shimmer token
 * and collapses under prefers-reduced-motion via the global guard.
 */
function Shimmer({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer bg-[linear-gradient(100deg,var(--color-line)_40%,var(--color-surface)_50%,var(--color-line)_60%)] bg-[length:200%_100%] ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <Shimmer className="h-10 w-24 rounded-xl" />
      <Shimmer className="mt-4 h-6 w-3/4 rounded-md" />
      <Shimmer className="mt-2 h-4 w-full rounded-md" />
      <Shimmer className="mt-2 h-4 w-2/3 rounded-md" />
    </div>
  );
}

export function PathGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading learning paths">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <CardSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function StatsBandSkeleton() {
  return (
    <div className="rounded-2xl bg-ink px-6 py-8" aria-label="Loading statistics">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex flex-col items-center px-2 py-3">
            <div aria-hidden="true" className="h-9 w-16 rounded-md bg-study-raised" />
            <div aria-hidden="true" className="mt-2 h-4 w-24 rounded-md bg-study-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
