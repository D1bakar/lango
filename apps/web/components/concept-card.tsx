// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { MasteryBar } from "./mastery-bar";
import type { MasteryState } from "./mastery-bar";

/**
 * Grammar concept card: the authored teaching unit a correction cites.
 * Shows the rule summary, mastery state, and example pair.
 */
export function ConceptCard({
  title,
  conceptKey,
  summary,
  exampleTarget,
  exampleNative,
  mastery,
  masteryValue,
}: {
  title: string;
  conceptKey: string;
  summary: string;
  exampleTarget: string;
  exampleNative: string;
  mastery: MasteryState;
  masteryValue: number;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-6 shadow-card">
      <p className="text-xs font-medium tracking-wide text-accent uppercase">Concept</p>
      <h3 className="mt-2 font-serif text-xl">{title}</h3>
      <p className="mt-1 font-mono text-xs text-faint">{conceptKey}</p>
      <p className="mt-3 text-sm text-muted">{summary}</p>
      <blockquote className="mt-4 rounded-xl border border-line bg-canvas px-4 py-3">
        <p className="text-[15px] text-ink">{exampleTarget}</p>
        <p className="mt-1 text-sm text-muted">{exampleNative}</p>
      </blockquote>
      <div className="mt-4">
        <MasteryBar state={mastery} value={masteryValue} />
      </div>
    </article>
  );
}
