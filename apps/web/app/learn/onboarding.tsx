"use client";

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { LanguagePairSummary, LanguageSummary } from "@lingua/types";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";

type StepId = "native" | "target" | "level" | "goal" | "plan";

const STEPS: { id: StepId; label: string }[] = [
  { id: "native", label: "Your language" },
  { id: "target", label: "What you want to learn" },
  { id: "level", label: "Starting point" },
  { id: "goal", label: "Your goal" },
  { id: "plan", label: "Your plan" },
];

/**
 * CEFR ladder duplicated from @lingua/types on purpose.
 *
 * Importing the constant would pull zod into the browser bundle for the sake of
 * seven strings. Types are imported as types only, so they cost nothing.
 */
const CEFR_LADDER = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

const LEVEL_COPY: Record<string, { title: string; detail: string }> = {
  A0: { title: "Absolute beginner", detail: "I know a few words at most." },
  A1: { title: "Some basics", detail: "I can greet people and use set phrases." },
  A2: { title: "Elementary", detail: "I can handle simple everyday exchanges." },
  B1: { title: "Intermediate", detail: "I can hold a conversation on familiar topics." },
  B2: { title: "Upper intermediate", detail: "I can discuss most topics, with some effort." },
  C1: { title: "Advanced", detail: "I use the language fluently and flexibly." },
  C2: { title: "Proficient", detail: "I understand almost everything I read or hear." },
};

const GOALS: { value: string; title: string; detail: string }[] = [
  { value: "travel", title: "Travel", detail: "Get around and talk to people." },
  { value: "work", title: "Work", detail: "Use it professionally." },
  { value: "exam", title: "An exam", detail: "Prepare for a specific test." },
  { value: "family", title: "Family or friends", detail: "Speak with people close to me." },
  { value: "media", title: "Books and film", detail: "Understand what I watch and read." },
  { value: "other", title: "Something else", detail: "My own reason." },
];

const MINUTES = [10, 15, 20, 30];

export type OnboardingProps = {
  languages: LanguageSummary[];
  pairsByNative: Record<string, LanguagePairSummary[]>;
};

export function Onboarding({ languages, pairsByNative }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [nativeTag, setNativeTag] = useState<string>();
  const [targetTag, setTargetTag] = useState<string>();
  const [level, setLevel] = useState<string>();
  const [goal, setGoal] = useState<string>();
  const [minutes, setMinutes] = useState(15);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const step = STEPS[stepIndex];

  // Animate step transitions
  const transitionToStep = useCallback((updater: () => void) => {
    setIsTransitioning(true);
    setSaveError(null);
    setTimeout(() => {
      updater();
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  }, []);
  const origins = useMemo(
    () => languages.filter((language) => language.packs_from > 0),
    [languages],
  );
  const targets = useMemo(
    () => (nativeTag === undefined ? [] : (pairsByNative[nativeTag] ?? [])),
    [nativeTag, pairsByNative],
  );
  const pair = targets.find((candidate) => candidate.target.tag === targetTag);
  const pack = pair?.packs[0];

  const levels = useMemo(() => {
    if (pair === undefined) {
      return [];
    }
    const from = CEFR_LADDER.indexOf(pair.packs[0]?.cefr_from ?? "A1");
    const to = CEFR_LADDER.indexOf(pair.packs[0]?.cefr_to ?? "A1");
    if (from === -1 || to === -1) {
      return [];
    }
    return CEFR_LADDER.slice(Math.min(from, to), Math.max(from, to) + 1);
  }, [pair]);

  if (origins.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface p-8">
        <h2 className="font-serif text-xl">No language packs yet</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The API is running, but it found no curriculum. Add a pack under{" "}
          <code className="text-ink">
            content/packs/&#123;native&#125;--&#123;target&#125;/&#123;cefr&#125;/
          </code>{" "}
          and it will appear here.
        </p>
      </section>
    );
  }

  function choose(apply: () => void): void {
    transitionToStep(() => {
      apply();
      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    });
  }

  // Save onboarding choices to the API
  async function saveOnboarding(): Promise<void> {
    setIsSaving(true);
    setSaveError(null);
    try {
      // This would POST to /v1/learning-plan when auth is wired up
      // For now, we show the plan without persistence
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save your choices. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
        Step {stepIndex + 1} of {STEPS.length} · nothing is saved yet
      </p>
      <ol aria-label="Progress" className="mt-4 flex flex-wrap gap-2 text-xs">
        {STEPS.map((entry, index) => (
          <li
            key={entry.id}
            className={
              index === stepIndex
                ? "rounded-full bg-ink px-3 py-1.5 font-medium text-ink-invert"
                : index < stepIndex
                  ? "rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent-strong"
                  : "rounded-full border border-line bg-surface px-3 py-1.5 text-muted"
            }
          >
            {index + 1}. {entry.label}
          </li>
        ))}
      </ol>

      <div className="mt-10">
        {step?.id === "native" ? (
          <Step
            title="Which language do you speak?"
            detail="Explanations and translations are written for your language, not translated into it. That is why the pairs matter."
          >
            {origins.map((language) => (
              <Choice
                key={language.tag}
                selected={nativeTag === language.tag}
                onClick={() => choose(() => setNativeTag(language.tag))}
                title={`${language.english_name} (${language.native_name})`}
                detail={`${language.packs_from} ${language.packs_from === 1 ? "path" : "paths"} available`}
              />
            ))}
          </Step>
        ) : null}

        {step?.id === "target" ? (
          <Step
            title="What do you want to learn?"
            detail="Only languages with a curriculum are listed, so you will not choose something that turns out to be empty."
          >
            {targets.map((candidate) => (
              <Choice
                key={candidate.target.tag}
                selected={targetTag === candidate.target.tag}
                onClick={() => choose(() => setTargetTag(candidate.target.tag))}
                title={`${candidate.target.english_name} (${candidate.target.native_name})`}
                detail={`${candidate.packs.length} ${candidate.packs.length === 1 ? "pack" : "packs"} · written in ${candidate.target.script}, ${describeDirection(candidate.target.direction)}`}
              />
            ))}
          </Step>
        ) : null}

        {step?.id === "level" ? (
          <Step
            title="Where are you starting?"
            detail="This sets the ceiling for everything you are taught and everything the mentor is allowed to say."
          >
            {levels.map((code) => (
              <Choice
                key={code}
                selected={level === code}
                onClick={() => choose(() => setLevel(code))}
                title={`${LEVEL_COPY[code]?.title ?? code} · ${code}`}
                detail={LEVEL_COPY[code]?.detail ?? ""}
              />
            ))}
            <p className="text-sm text-muted sm:col-span-2">
              Not sure where you stand?{" "}
              <Link href="/placement" className="font-medium text-accent-strong hover:underline">
                Take the 10-minute placement check
              </Link>{" "}
              — it finds your level through doing, not guessing.
            </p>
          </Step>
        ) : null}

        {step?.id === "goal" ? (
          <Step
            title="Why are you learning it?"
            detail="The goal decides which vocabulary and situations the curriculum reaches for first."
          >
            {GOALS.map((option) => (
              <Choice
                key={option.value}
                selected={goal === option.value}
                onClick={() => setGoal(option.value)}
                title={option.title}
                detail={option.detail}
              />
            ))}

            <fieldset className="mt-8 sm:col-span-2">
              <legend className="text-sm font-medium text-ink">
                How long do you want to practise each day?
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {MINUTES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={minutes === value}
                    onClick={() => setMinutes(value)}
                    className={
                      minutes === value
                        ? "rounded-md border border-accent bg-accent-soft px-4 py-2 text-sm text-accent-strong"
                        : "rounded-md border border-line px-4 py-2 text-sm text-muted hover:border-accent hover:text-ink"
                    }
                  >
                    {value} minutes
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-8 sm:col-span-2">
              <button
                type="button"
                disabled={goal === undefined}
                onClick={() => setStepIndex((current) => current + 1)}
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-lift hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                See my plan
              </button>
              {goal === undefined ? (
                <p className="mt-2 text-sm text-muted">Pick a goal above to continue.</p>
              ) : null}
            </div>
          </Step>
        ) : null}

        <div
          className={`transition-all duration-200 ease-out ${
            isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          }`}
        >
          {step?.id === "plan" ? (
            <Plan
              nativeName={languages.find((language) => language.tag === nativeTag)?.english_name}
              targetName={pair?.target.english_name}
              packTitle={pack?.title}
              packDescription={pack?.description}
              cefrFrom={pack?.cefr_from}
              cefrTo={pack?.cefr_to}
              estimatedMinutes={pack?.estimated_minutes ?? 0}
              packStatus={pack?.status}
              level={level}
              goal={GOALS.find((option) => option.value === goal)?.title}
              minutes={minutes}
              onSave={saveOnboarding}
              isSaving={isSaving}
            />
          ) : null}

          {saveError ? (
            <div className="mt-4 rounded-lg border border-warn/40 bg-warn-soft px-5 py-4 text-sm text-muted">
              <span className="text-ink">Error:</span> {saveError}
            </div>
          ) : null}
        </div>
      </div>

      {stepIndex > 0 ? (
        <div className="mt-10" aria-live="polite" aria-atomic="false">
          <button
            type="button"
            onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
            className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            Back
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Step({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section>
      <h1 className="font-serif text-3xl text-balance sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-muted">{detail}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Choice({
  title,
  detail,
  selected,
  onClick,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        selected
          ? "w-full rounded-2xl border-2 border-accent bg-accent-soft px-5 py-4 text-left shadow-card"
          : "w-full rounded-2xl border border-line bg-surface px-5 py-4 text-left shadow-card hover:-translate-y-0.5 hover:border-accent hover:shadow-lift"
      }
    >
      <span className="block text-[15px] font-medium text-ink">{title}</span>
      {detail.length > 0 ? <span className="mt-1 block text-sm text-muted">{detail}</span> : null}
    </button>
  );
}

function Plan({
  nativeName,
  targetName,
  packTitle,
  packDescription,
  cefrFrom,
  cefrTo,
  estimatedMinutes,
  packStatus,
  level,
  goal,
  minutes,
  onSave,
  isSaving,
}: {
  nativeName: string | undefined;
  targetName: string | undefined;
  packTitle: string | undefined;
  packDescription: string | undefined;
  cefrFrom: string | undefined;
  cefrTo: string | undefined;
  estimatedMinutes: number;
  packStatus: string | undefined;
  level: string | undefined;
  goal: string | undefined;
  minutes: number;
  onSave: () => void;
  isSaving: boolean;
}) {
  const hours = estimatedMinutes > 0 ? Math.round(estimatedMinutes / 60) : 0;
  const levelRange =
    cefrFrom === undefined || cefrTo === undefined
      ? "—"
      : cefrFrom === cefrTo
        ? cefrFrom
        : `${cefrFrom}–${cefrTo}`;

  const reviewMinutes = Math.max(3, Math.round(minutes * 0.2));
  const lessonMinutes = Math.max(4, minutes - reviewMinutes - 5);

  return (
    <section>
      <h1 className="font-serif text-3xl">Your plan</h1>
      <p className="mt-3 max-w-xl text-muted">
        This is your personalized learning plan. Sign up to save your progress and start learning.
      </p>

      <dl className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
        <Row label="Learning" value={targetName ?? "—"} />
        <Row label="Explained in" value={nativeName ?? "—"} />
        <Row label="Starting level" value={level ?? "—"} />
        <Row label="Goal" value={goal ?? "—"} />
        <Row label="Curriculum" value={packTitle ?? "—"} />
        <Row label="Level range" value={levelRange} />
        <Row label="Material" value={hours > 0 ? `about ${hours} hours` : "—"} />
      </dl>

      {packDescription !== undefined ? (
        <p className="mt-4 text-sm text-muted">{packDescription}</p>
      ) : null}

      <p className="mt-4 rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-muted">
        Why this plan? Every row above is built from the pack&apos;s own metadata — level range,
        hours, and daily loop are computed, not guessed. When the curriculum changes, this plan
        changes with it.
      </p>

      <div className="mt-8">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Saving...
            </span>
          ) : (
            "Get started"
          )}
        </button>
      </div>

      <h2 className="mt-12 font-serif text-xl">Your daily loop</h2>
      <ol className="mt-4 space-y-3 text-sm text-ink">
        <li>
          <span className="font-medium">Lesson</span>{" "}
          <span className="text-muted">
            — about {lessonMinutes} minutes of new material and exercises
          </span>
        </li>
        <li>
          <span className="font-medium">Speak</span>{" "}
          <span className="text-muted">
            — 5 minutes with the mentor, on the concepts the lesson just introduced
          </span>
        </li>
        <li>
          <span className="font-medium">Review</span>{" "}
          <span className="text-muted">
            — about {reviewMinutes} minutes of concepts scheduled before you forget them
          </span>
        </li>
      </ol>

      {packStatus !== "published" ? (
        <p className="mt-8 rounded-lg border border-warn/40 bg-warn-soft px-5 py-4 text-sm text-muted">
          This pack is still in <span className="text-ink">{packStatus ?? "draft"}</span>, so its
          lessons are not playable yet. The plan above is real: it is built from the pack&apos;s own
          metadata.
        </p>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-5 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  );
}

function describeDirection(direction: string): string {
  if (direction === "rtl") {
    return "right to left";
  }
  if (direction === "ttb") {
    return "top to bottom";
  }
  return "left to right";
}
