// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

export type MasteryState = "introduced" | "practising" | "mastered" | "decaying";

const STATE_STYLES: Record<MasteryState, { bar: string; label: string }> = {
  introduced: { bar: "bg-mastery-introduced", label: "Introduced" },
  practising: { bar: "bg-mastery-practising", label: "Practising" },
  mastered: { bar: "bg-mastery-mastered", label: "Mastered" },
  decaying: { bar: "bg-mastery-decaying", label: "Needs review" },
};

/**
 * Concept mastery indicator. Fill is proportion mastered (0–1);
 * state sets the colour family and the always-visible text label.
 */
export function MasteryBar({
  state,
  value,
  label,
}: {
  state: MasteryState;
  value: number;
  label?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const styles = STATE_STYLES[state];
  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-label={label ?? `Concept mastery: ${styles.label}`}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={`h-full rounded-full transition-[width] ${styles.bar}`}
          style={{ width: `${Math.round(clamped * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {label ?? styles.label} · {Math.round(clamped * 100)}%
      </p>
    </div>
  );
}
