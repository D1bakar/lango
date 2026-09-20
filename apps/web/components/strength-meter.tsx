// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

export type WordStrength = "weak" | "medium" | "strong";

const STRENGTH_LEVELS: Record<WordStrength, { filled: number; label: string }> = {
  weak: { filled: 1, label: "Weak" },
  medium: { filled: 2, label: "Medium" },
  strong: { filled: 3, label: "Strong" },
};

/**
 * Vocabulary strength meter: three segments plus a text label,
 * so strength is never colour-alone.
 */
export function StrengthMeter({ strength, word }: { strength: WordStrength; word: string }) {
  const { filled, label } = STRENGTH_LEVELS[strength];
  return (
    <span
      role="img"
      aria-label={`${word}: ${label} memory strength, ${filled} of 3`}
      className="inline-flex items-center gap-1"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={
            index < filled
              ? "h-1.5 w-5 rounded-full bg-mastery-practising"
              : "h-1.5 w-5 rounded-full bg-line"
          }
        />
      ))}
      <span className="ml-1 text-xs text-muted">{label}</span>
    </span>
  );
}
