// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import Link from "next/link";

/**
 * Unknown routes land here with a way back into the curriculum —
 * never a dead end.
 */
export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl py-12 text-center">
      <p className="text-xs font-medium tracking-wide text-accent uppercase">Not found</p>
      <h1 className="mt-3 font-serif text-3xl sm:text-4xl">There is no lesson here yet.</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        The page you asked for does not exist. Your learning paths are one step away.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/learn"
          className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-strong"
        >
          Find your path
        </Link>
        <Link
          href="/"
          className="rounded-md border border-line bg-surface px-6 py-3 text-sm text-ink hover:border-line-strong"
        >
          Back home
        </Link>
      </div>
    </section>
  );
}
