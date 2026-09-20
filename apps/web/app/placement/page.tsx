// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Placement check",
};

/**
 * Placement preview. The adaptive check itself ships in Phase E;
 * this page sets the contract: prove it through doing, not self-report.
 */
export default function PlacementPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-12">
      <SectionHeading
        eyebrow="Placement"
        title="Find your level by using the language."
        action={<ButtonLink href="/learn">Choose a level for now →</ButtonLink>}
      >
        <p>
          Self-reported levels are guesses. The placement check ramps real exercises until you miss
          twice in a row — then places you, and tells you why.
        </p>
      </SectionHeading>

      <ol className="grid gap-5 sm:grid-cols-3">
        <PlacementStep
          n="1"
          title="Start easy"
          body="Recognition first: match, choose, listen. About three minutes of warm-up."
        />
        <PlacementStep
          n="2"
          title="Ramp up"
          body="Constrained production, then free production. Difficulty climbs with every success."
        />
        <PlacementStep
          n="3"
          title="Get placed"
          body="Two consecutive misses set your ceiling. You see the band, the evidence, and your first lesson."
        />
      </ol>

      <section className="rounded-2xl bg-ink p-8 text-ink-invert sm:p-10">
        <h2 className="font-serif text-2xl">The check is not built yet.</h2>
        <p className="mt-3 max-w-xl text-sm opacity-80">
          Adaptive placement needs the attempts API and the learner model reads from Phase E. Until
          then, pick your level honestly in onboarding — the mentor stays inside whatever ceiling
          you set.
        </p>
        <ButtonLink href="/learn" variant="secondary" className="mt-6">
          Continue to onboarding →
        </ButtonLink>
      </section>
    </div>
  );
}

function PlacementStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-6 shadow-card">
      <p className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-base text-ink-invert">
        {n}
      </p>
      <h3 className="mt-4 font-medium text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </li>
  );
}
