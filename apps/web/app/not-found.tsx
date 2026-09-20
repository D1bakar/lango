// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { ButtonLink } from "@/components/button";

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
        <ButtonLink href="/learn">Find your path</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Back home
        </ButtonLink>
      </div>
    </section>
  );
}
