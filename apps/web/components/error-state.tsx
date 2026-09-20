// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { ReactNode } from "react";

/**
 * User-facing error state with retry. Plain language, one recovery
 * action, no stack traces or CLI commands on public surfaces.
 */
export function ErrorState({
  title,
  children,
  onRetry,
  retryLabel = "Try again",
}: {
  title: string;
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-warn/40 bg-warn-soft px-8 py-12 text-center"
    >
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <div className="mx-auto mt-3 max-w-md text-sm text-muted">{children}</div>
      {onRetry !== undefined ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-ink-invert hover:opacity-90"
        >
          {retryLabel}
        </button>
      ) : null}
    </section>
  );
}
