// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import Link from "next/link";
import type { ReactNode } from "react";
import { CorrectionCard } from "@/components/correction-card";
import { PathCard } from "@/components/path-card";
import type { PathCardData } from "@/components/path-card";
import { SectionHeading } from "@/components/section-heading";
import { fetchContentStatus, fetchLanguages, fetchPairs } from "@/lib/api";
import type { LanguagePairSummary } from "@lingua/types";

export const dynamic = "force-dynamic";

type PathCard = PathCardData;

const FALLBACK_PATHS: PathCard[] = [
  {
    key: "en-es",
    from: "EN",
    to: "ES",
    title: "English → Spanish",
    detail: "The seeded reference pack. Greetings, everyday exchanges, and present-tense verbs.",
    meta: "A1 · about 6 hours",
  },
  {
    key: "en-fr",
    from: "EN",
    to: "FR",
    title: "English → French",
    detail: "Travel-first vocabulary: stations, cafés, and polite forms that actually get used.",
    meta: "A1–A2 · coming next",
  },
  {
    key: "es-en",
    from: "ES",
    to: "EN",
    title: "Spanish → English",
    detail: "Work-focused path: introductions, email phrases, and meeting small talk.",
    meta: "A1 · coming next",
  },
];

const METHOD_CARDS = [
  {
    tag: "Learner model",
    title: "It remembers what you keep getting wrong",
    body: "Every concept is tracked as introduced, practised, mastered, or decaying — plus the exact mistakes you repeat. That history is assembled into the mentor's context before every turn.",
  },
  {
    tag: "Structured corrections",
    title: "Corrections you can act on, not chat prose",
    body: "A mistake returns with its span, category, severity, and the authored concept behind it — so the interface can show a grammar card and schedule a review instead of burying it in a log.",
  },
  {
    tag: "Grounded answers",
    title: "Explanations cite material a human wrote",
    body: "The mentor may only cite reviewed teaching content. A correction without a citable rule is suppressed and logged, because a confident wrong rule is worse than silence.",
  },
];

const STORIES = [
  {
    tag: "Milestone",
    title: "The catalog read path is live",
    body: "Choosing a language, level, and goal now runs on real content files through a validated API contract — the foundation every later phase builds on.",
  },
  {
    tag: "Method",
    title: "Why production beats recognition",
    body: "Most apps optimise for tapping the right answer. Fluency is producing the sentence yourself — and being corrected the moment you produce it wrong.",
  },
  {
    tag: "Roadmap",
    title: "What ships after the first pack",
    body: "Lessons, then the text mentor, then voice and accounts. Each arrives only when there is something real to put in it — no placeholder tabs.",
  },
];

export default async function HomePage() {
  const { pathCards, stats, apiLive } = await loadHomepage();

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      {/* Hero — split layout like the reference: copy left, live preview card right */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            Preview build · Catalog live{apiLive ? "" : " · API offline"}
          </p>
          <h1 className="mt-5 font-serif text-4xl leading-[1.08] text-balance sm:text-6xl">
            Become fluent, one correction at a time.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Lingua pairs a structured curriculum with an AI mentor that knows which concepts you
            have learned, which are fading, and which mistakes you repeat — and answers at your
            level, mid-lesson.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/learn"
              className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white shadow-lift hover:bg-accent-strong"
            >
              Find your path
            </Link>
            <Link
              href="/status"
              className="rounded-md border border-line bg-surface px-6 py-3 text-sm text-ink shadow-card hover:border-line-strong"
            >
              See live status
            </Link>
          </div>
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
            <div className="flex items-center gap-2">
              <CheckIcon />
              No accounts yet — nothing is saved
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon />
              CEFR A0–C2 ladder
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon />
              Grounded explanations only
            </div>
          </dl>
        </div>

        {/* Mentor preview card — the visual anchor, like the reference hero image */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-2xl bg-accent-mist/60 blur-2xl"
          />
          <div className="relative animate-float rounded-2xl border border-line bg-surface p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">
                Mentor · Lesson 3
              </p>
              <p className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong">
                A1 · capped at your level
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
              <p className="text-sm text-muted">You wrote</p>
              <p className="mt-1 text-[15px] text-ink">
                Yo <Mark>soy 22 años</Mark> y vivo en Madrid.
              </p>
            </div>
            <div className="mt-3">
              <CorrectionCard
                original="soy 22 años"
                corrected="tengo 22 años"
                explanation="Age uses tener, not ser."
                conceptKey="ser-vs-estar-basics"
                category="agreement"
                severity={1}
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>Learner model · 14 concepts tracked</span>
              <Link href="/learn" className="font-medium text-accent-strong hover:underline">
                Try the onboarding →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band — like the reference counters */}
      <section aria-label="Catalog statistics" className="rounded-2xl bg-ink text-ink-invert">
        <dl className="grid grid-cols-2 divide-line/10 px-6 py-8 sm:grid-cols-4 sm:divide-x">
          <Stat value={String(stats.languages)} label="Languages defined" />
          <Stat value={String(stats.packs)} label="Language packs" />
          <Stat value={String(stats.published)} label="Packs published" />
          <Stat value="A0–C2" label="CEFR ladder tracked" />
        </dl>
      </section>

      {/* Popular paths — card grid like "Upcoming camps" */}
      <section id="paths" className="scroll-mt-24">
        <SectionHeading
          eyebrow="Curriculum"
          title="Start from a real path, not an empty search."
          action={
            <Link
              href="/learn"
              className="rounded-md border border-line bg-surface px-4 py-2 text-sm text-ink shadow-card hover:border-line-strong"
            >
              View all paths →
            </Link>
          }
        >
          <p>
            Only pairs with authored curriculum are listed — you will never pick something that
            turns out to be empty.{" "}
            {apiLive
              ? "Live from the running API."
              : "Showing preview examples while the API is offline."}
          </p>
        </SectionHeading>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pathCards.map((card) => (
            <PathCard key={card.key} card={card} href="/learn" />
          ))}
        </ul>
      </section>

      {/* For contributors — two large cards like "For organisations" */}
      <section id="contribute" className="scroll-mt-24">
        <p className="text-xs font-medium tracking-wide text-accent uppercase">For contributors</p>
        <h2 className="mt-2 max-w-2xl font-serif text-3xl text-balance sm:text-4xl">
          Teaching a language? Help write or review it.
        </h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface-warm p-8 shadow-card">
            <h3 className="font-serif text-2xl">Write a language pack</h3>
            <p className="mt-2 text-sm text-muted">
              Packs are versioned YAML under <code>content/packs/</code> — concepts, lessons, and
              review rules a human can read and diff.
            </p>
            <Link
              href="/status"
              className="mt-6 inline-block rounded-md bg-ink px-4 py-2 text-sm font-medium text-ink-invert hover:opacity-90"
            >
              Check what loaded →
            </Link>
          </div>
          <div className="rounded-2xl bg-ink p-8 text-ink-invert shadow-card">
            <h3 className="font-serif text-2xl">Review as a fluent speaker</h3>
            <p className="mt-2 text-sm opacity-80">
              Validation refuses to publish a pack without a fluent reviewer. Your review is what
              unlocks lessons for every learner after you.
            </p>
            <Link
              href="/learn"
              className="mt-6 inline-block rounded-md bg-ink-invert px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
            >
              See the flow →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works — three steps like the reference */}
      <section
        id="how"
        className="scroll-mt-24 rounded-2xl border border-line bg-surface p-8 shadow-card sm:p-10"
      >
        <p className="text-xs font-medium tracking-wide text-accent uppercase">How Lingua works</p>
        <h2 className="mt-2 font-serif text-3xl text-balance sm:text-4xl">
          One plan, every lesson inside it.
        </h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          <HowStep
            n="1"
            title="Share goal and level"
            body="One screen: your language, your target, your CEFR level, and why you are learning. The ceiling for everything taught is set here."
          />
          <HowStep
            n="2"
            title="Learn in a daily loop"
            body="New material plus exercises, five minutes speaking with the mentor, then scheduled review — sized to the minutes you actually have."
          />
          <HowStep
            n="3"
            title="The mentor remembers"
            body="Mistakes become structured corrections tied to authored concepts, so revision targets what you repeat — not a generic deck."
          />
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/learn"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Build my plan
          </Link>
          <Link
            href="/#level"
            className="rounded-md border border-line px-5 py-2.5 text-sm text-ink hover:bg-canvas"
          >
            Check your level first
          </Link>
        </div>
      </section>

      {/* Level checker — interactive widget like "Check eligibility" */}
      <section id="level" className="grid scroll-mt-24 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-line bg-surface-warm p-8">
          <p className="text-xs font-medium tracking-wide text-accent uppercase">Placement</p>
          <h2 className="mt-2 font-serif text-3xl">Where are you starting?</h2>
          <p className="mt-3 text-sm text-muted">
            Pick the line that sounds most like you. This sets the ceiling for everything you are
            taught — and everything the mentor may say.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              ["A0–A1", "Greetings and set phrases."],
              ["A2", "Simple everyday exchanges."],
              ["B1–B2", "Conversations on familiar topics."],
              ["C1–C2", "Fluent, flexible use."],
            ].map(([level, copy]) => (
              <li
                key={level}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3"
              >
                <span className="font-medium text-ink">{level}</span>
                <span className="text-muted">{copy}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center rounded-2xl bg-ink p-8 text-ink-invert sm:p-10">
          <p className="font-serif text-2xl text-balance">
            “The mentor stays inside your lessons — no subjunctive in lesson three.”
          </p>
          <p className="mt-4 text-sm opacity-75">
            Your level caps the grammar, vocabulary, and corrections you will see. Raise it by
            demonstrating mastery, not by scrolling further.
          </p>
          <div className="mt-6">
            <Link
              href="/learn"
              className="inline-block rounded-md bg-ink-invert px-5 py-2.5 text-sm font-medium text-ink hover:opacity-90"
            >
              Set my level →
            </Link>
          </div>
        </div>
      </section>

      {/* Stories / method — three cards like "From the blog" */}
      <section id="method" className="scroll-mt-24">
        <SectionHeading
          eyebrow="Method"
          title="A teacher, not a chat window."
          action={
            <Link href="/status" className="text-sm font-medium text-accent-strong hover:underline">
              Verify the running build →
            </Link>
          }
        />
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {METHOD_CARDS.map((card) => (
            <li
              key={card.title}
              className="rounded-2xl border border-line bg-surface p-6 shadow-card"
            >
              <p className="text-xs font-medium tracking-wide text-accent uppercase">{card.tag}</p>
              <h3 className="mt-2 font-serif text-xl leading-snug">{card.title}</h3>
              <p className="mt-2 text-sm text-muted">{card.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Project stories"
        className="rounded-2xl border border-line bg-surface p-8 shadow-card sm:p-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-2xl sm:text-3xl">Build notes &amp; what is next</h2>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-strong">
            Honest status, not a demo that hides it
          </span>
        </div>
        <ul className="mt-6 grid gap-6 md:grid-cols-3">
          {STORIES.map((story) => (
            <li key={story.title} className="border-t border-line pt-4">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">{story.tag}</p>
              <h3 className="mt-2 font-medium text-ink">{story.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{story.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 grid gap-8 rounded-xl bg-canvas p-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium tracking-wide text-accent uppercase">
              Working today
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-ink">
              <li>Language catalog from real content files</li>
              <li>Validation that blocks unreviewed packs</li>
              <li>Language · level · goal onboarding</li>
              <li>Shared, tested API contracts</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
              Not built yet
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              <li>Playable lessons beyond the seed unit</li>
              <li>The AI mentor, in text or voice</li>
              <li>Accounts — nothing is saved</li>
              <li>Progress, scheduling, streaks</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="overflow-hidden rounded-2xl bg-accent px-8 py-12 text-center text-white shadow-lift sm:px-12">
        <h2 className="mx-auto max-w-2xl font-serif text-3xl text-balance sm:text-4xl">
          Your target language is already waiting. Start with the plan.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm opacity-85">
          Two minutes: your language, your goal, your daily minutes. No account, no commitment — the
          plan is built from the pack&apos;s own metadata.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/learn"
            className="rounded-md bg-white px-6 py-3 text-sm font-medium text-accent-strong hover:opacity-90"
          >
            Choose a language
          </Link>
          <Link
            href="/status"
            className="rounded-md border border-white/40 px-6 py-3 text-sm text-white hover:bg-white/10"
          >
            Verify the build
          </Link>
        </div>
      </section>
    </div>
  );
}

async function loadHomepage(): Promise<{
  pathCards: PathCard[];
  stats: { languages: number; packs: number; published: number };
  apiLive: boolean;
}> {
  try {
    const [languages, status] = await Promise.all([fetchLanguages(), fetchContentStatus()]);
    let pairs: LanguagePairSummary[] = [];
    const firstOrigin = languages.find((language) => language.packs_from > 0);
    if (firstOrigin !== undefined) {
      pairs = await fetchPairs(firstOrigin.tag);
    }
    const cards = pairs.slice(0, 3).map((pair) => {
      const pack = pair.packs[0];
      return {
        key: `${pair.native_tag}-${pair.target.tag}`,
        from: pair.native_tag.slice(0, 2).toUpperCase(),
        to: pair.target.tag.slice(0, 2).toUpperCase(),
        title: `${capitalize(pair.native_tag)} → ${pair.target.english_name}`,
        detail: pack?.description ?? `${pair.target.english_name} curriculum.`,
        meta:
          pack === undefined
            ? "curriculum"
            : `${pack.cefr_from}–${pack.cefr_to} · about ${Math.max(1, Math.round(pack.estimated_minutes / 60))}h`,
      };
    });
    return {
      pathCards: cards.length > 0 ? cards : FALLBACK_PATHS,
      stats: {
        languages: status.languages,
        packs: status.packs,
        published: status.packs_published,
      },
      apiLive: true,
    };
  } catch {
    return {
      pathCards: FALLBACK_PATHS,
      stats: { languages: 0, packs: 0, published: 0 },
      apiLive: false,
    };
  }
}

function capitalize(tag: string): string {
  return tag.length === 0 ? tag : tag.charAt(0).toUpperCase() + tag.slice(1);
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-3 text-center sm:px-6">
      <dd className="font-serif text-3xl sm:text-4xl">{value}</dd>
      <dt className="mt-1 text-[13px] opacity-70">{label}</dt>
    </div>
  );
}

function HowStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li>
      <p className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-base text-ink-invert">
        {n}
      </p>
      <h3 className="mt-4 font-medium text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </li>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-accent">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 8.2 7.2 10l3.3-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-red-100 px-1 text-red-900 underline decoration-red-300 decoration-wavy underline-offset-2">
      {children}
    </span>
  );
}
