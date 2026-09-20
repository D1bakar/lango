// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Designed empty state: what is missing, why, and the one action
 * that fills it. Never a bare grey box.
 */
export function EmptyState({
  title,
  children,
  actionLabel,
  actionHref,
}: {
  title: string;
  children: ReactNode;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-line-strong bg-surface px-8 py-12 text-center">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mx-auto mt-3 max-w-md text-sm text-muted">{children}</div>
      {actionLabel !== undefined && actionHref !== undefined ? (
        <Link
          href={actionHref}
          className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
        >
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
