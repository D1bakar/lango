# 06 — Language pack specification

A **language pack** is the unit of authored content, versioning, licensing, and community
contribution. It is written in YAML, reviewed like code, validated in CI, and imported into the
database by a job. This document is the contract contributors author against.

See ADR-0008 for why content is a pack rather than rows in an admin UI.

## Repository layout

```
content/
  languages/                 shared, one file per language
    es.yaml
    en.yaml
  normalization/             grading profiles, one per language
    es.yaml
    ja.yaml
  packs/
    en--es/
      a1/
        pack.yaml
        courses/
          a1-core.yaml
        units/
          01-greetings.yaml
          02-introductions.yaml
        lessons/
          01-01-hello.yaml
          01-02-your-name.yaml
        concepts/
          ser_vs_estar.yaml
          greetings.yaml
        exercises/
          01-01-hello.yaml     # may instead inline exercises in the lesson file
```

Rules:

- Pack directory is always `{native}--{target}/{cefr}/`.
- Slugs are `kebab-case`, stable forever. Renaming a slug is a MAJOR version change.
- **Inline exercises in the lesson file** while a lesson has fewer than ~15 exercises. Extract
  to `exercises/` when it grows. Do not pre-optimize the file layout.
- Files are the review surface: a content PR is reviewed in a diff, exactly like code.

---

## `content/languages/{tag}.yaml`

Shared across every pack that uses the language. This file is the mechanism by which the
architecture stays language-agnostic — everything the engine needs to branch on lives here.

```yaml
schema_version: 1
tag: es
english_name: Spanish
native_name: Español
script: Latn
text_direction: ltr
transliteration_scheme: null # pinyin | romaji | iso-233 | null
transliteration_required: false
tokenizer_profile: whitespace # whitespace | cjk | thai
normalization_profile: es

morphology:
  has_grammatical_gender: true
  genders: [masculine, feminine]
  has_cases: false
  case_count: 0
  has_counter_words: false
  has_formal_register: true # tú / usted
  has_diacritics: true
  has_tones: false

tts:
  default_voice_id: "<provider-voice-id>"
  rate: 0.95
  providers:
    neural: { voice_id: "<provider-voice-id>" }
    premium: { voice_id: "<provider-voice-id>" }

stt:
  language_code: es
  bias_strategy: lesson_vocabulary # boost current lesson's lemmas in decoding
  # Explicit example of why morphology is data, not code:
  error_heuristics:
    - category: grammar_agreement
      subcategory_key: ser_vs_estar
      signals: ["soy cansado", "es aburrido"] # seeded into the mentor's guidance

content_policy:
  forbidden_terms: []
  min_age_rating: general
```

`error_heuristics` is pack-authored, human-reviewed guidance about what mistakes are likely for
this language. The mentor receives these hints rather than being asked to reason about Spanish
grammar unaided.

## `content/normalization/{profile}.yaml`

The grading contract. **Answer normalization is language-specific and cannot be generic.**

```yaml
schema_version: 1
profile: es
rules:
  trim: true
  collapse_whitespace: true
  case_sensitive: false
  diacritics: required # required | optional | ignore
  punctuation: ignore # ignore | required
  inverted_punctuation: ignore # ¿ ¡
  accept_missing_opening_marks: true
  numeric_normalization: true
  ignore_articles: false
notes: >
  Accents are required in Spanish — accepting "esta" for "está" would teach a
  wrong habit. Inverted marks are accepted as omitted at A1 only.
```

Contrast `ja.yaml`: `diacritics: ignore`, `script_folding: [kana_ok_for_kanji]`,
`width_normalization: true`. Contrast `ar.yaml`: `diacritics: ignore` (short vowels are usually
unwritten). A single generic normalizer would mark every one of these wrong.

---

## `pack.yaml`

```yaml
schema_version: 1
pack_key: en-es-a1
native_language: en
target_language: es
cefr_from: A1
cefr_to: A1
title: Spanish from English — Foundations
description: >
  Complete A1 path. ~40 lessons across 10 units, roughly 25 hours of study,
  built around speaking from lesson one.
version: 1.0.0
license: CC-BY-NC-4.0
authors: [{ name: "", contact: "" }]
review:
  status: published
  reviewers:
    - { name: "", role: native_speaker }
    - { name: "", role: curriculum }
changelog:
  - version: 1.0.0
    date: 2026-09-20
    notes: Initial A1 release.
# REQUIRED for MAJOR version bumps only. Maps removed/renamed concept keys.
migrations:
  # - from_key: es.greetings.formal
  #   to_key: es.greetings.register
  #   strategy: carry_mastery
```

`migrations` is what protects learner progress across content edits. Import MUST fail on a MAJOR
bump without it. Losing a learner's mastery record because a concept was renamed is the one
content mistake users never forgive.

---

## `concepts/{key}.yaml`

```yaml
key: es.ser_vs_estar.present # namespace.kebab-case, stable forever
kind: grammar # grammar|vocab|pronunciation|pragmatics|orthography|listening
title: "ser vs estar"
cefr_level: A1
summary_short: "ser for identity, estar for state"

# AUTHORED, REVIEWED TEXT. This is the only thing the AI mentor may ground
# explanations in. Never model-generated, never paraphrased at runtime.
explanation_md: |
  Both verbs mean "to be", but they answer different questions.

  **ser** answers *what something is*: identity, origin, profession, inherent
  characteristics. → *Soy inglés.* *Es profesora.*

  **estar** answers *how something is right now*: location and temporary state.
  → *Estoy cansado.* *Madrid está en España.*

  A useful test: if the condition could change tomorrow, use **estar**.

pronunciation_ipa: null
tags: [core, high-frequency, a1-essential]

prerequisites:
  - { key: es.subject_pronouns, strength: hard }
  - { key: es.adjective_agreement.basic, strength: soft }

common_errors:
  - "soy cansado"
  - "está profesora"
  - "es en Madrid"

examples:
  - { target: "Soy estudiante.", native: "I am a student.", register: neutral }
  - { target: "Estoy cansado.", native: "I am tired.", register: neutral }
  - { target: "Madrid está en España.", native: "Madrid is in Spain.", register: neutral }
```

Authoring rules enforced by the validator:

- `explanation_md` ≤ 1,200 characters. Long explanations are a UX failure, not thoroughness.
- 3–8 `examples`. Every example needs a `native` gloss.
- `common_errors` written as the learner's actual incorrect output, not a description.
- `summary_short` ≤ 160 characters, no trailing period.

---

## `units/{nn-slug}.yaml`

```yaml
slug: 01-greetings
title: Greetings and basics
summary: Say hello, introduce yourself, and ask someone's name.
order_index: 1
estimated_minutes: 150
course_slug: a1-core
lessons:
  - slug: 01-01-hello
  - slug: 01-02-your-name
```

## `lessons/{nn-nn-slug}.yaml`

```yaml
slug: 01-01-hello
title: Saying hello
unit_slug: 01-greetings
order_index: 1
lesson_type: concept_intro # concept_intro|practice|review|assessment|conversation
estimated_minutes: 12

# Authored guidance for the AI mentor. Reviewed like any other content.
mentor_brief: >
  Greet the learner in Spanish and introduce yourself. Stay within hola, buenos días,
  buenas tardes, buenas noches, and adiós. Do not introduce tú/usted yet — that is
  lesson 02. If the learner replies in English, recast gently in Spanish and continue.

concepts:
  - { key: es.greetings.basic, role: introduce, order_index: 1 }
  - { key: es.greetings.farewell, role: practise, order_index: 2 }

objectives:
  - Greet someone appropriately at different times of day
  - Say goodbye

exercises:
  - type: mcq
    prompt_md: "It's 9am. Which greeting fits?"
    payload:
      options:
        - { id: a, text: "Buenos días" }
        - { id: b, text: "Buenas noches" }
        - { id: c, text: "Adiós" }
    answer_spec: { correct: [a] }
    explanation_md: "*Buenos días* is used until roughly midday."
    difficulty: 1
    concepts: [es.greetings.basic]

  - type: type_answer
    prompt_md: "Write what you'd say to a friend at 8pm."
    payload: { placeholder: "Buenas…", max_length: 30 }
    answer_spec:
      accepted_answers: ["Buenas noches", "Buenas tardes"]
      alternatives: ["Buenas"]
    explanation_md: "Between evening and bedtime, *buenas noches* is standard."
    difficulty: 2
    concepts: [es.greetings.basic, es.greetings.farewell]

  - type: speak_repeat
    prompt_md: "Say it out loud"
    payload: { target_text: "Buenos días", transliteration: null }
    answer_spec: { expected_transcript: "buenos días", min_confidence: 0.6 }
    explanation_md: "Stress the first syllable of *días*."
    difficulty: 2
    concepts: [es.greetings.basic]
```

---

## Exercise types

| Type                  | `payload`                          | `answer_spec`                                            | Grading                                                                                        |
| --------------------- | ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `mcq`                 | `options[{id,text}]`               | `{ correct: [id] }`                                      | Exact                                                                                          |
| `multi_select`        | `options[{id,text}]`               | `{ correct: [id] }`                                      | Partial credit (Jaccard over sets)                                                             |
| `translate_to_target` | `{ source_text, hint? }`           | `{ accepted_answers[], alternatives[], normalization? }` | Normalized match, then alternatives, then LLM fallback                                         |
| `translate_to_native` | `{ target_text }`                  | `{ accepted_answers[] }`                                 | Normalized + embedding similarity ≥ 0.85                                                       |
| `reorder_tokens`      | `{ tokens[] }`                     | `{ correct_order: [idx] }`                               | Exact / longest correct prefix for partial                                                     |
| `fill_blank`          | `{ text_with_blanks[], blanks[] }` | `{ answers: [[...], [...]] }`                            | Per-blank normalized, mean score                                                               |
| `type_answer`         | `{ placeholder?, max_length? }`    | `{ accepted_answers[], alternatives[] }`                 | Normalized + alternatives                                                                      |
| `listen_select`       | `{ audio_ref, options[] }`         | `{ correct: [id] }`                                      | Exact                                                                                          |
| `listen_type`         | `{ audio_ref, placeholder? }`      | `{ accepted_answers[] }`                                 | Normalized                                                                                     |
| `speak_repeat`        | `{ target_text, transliteration }` | `{ expected_transcript, min_confidence }`                | **R0: normalized transcript match only.** Below `min_confidence` → `low_confidence`, not wrong |
| `speak_free`          | `{ scenario_key, prompt_md }`      | `{}` (no deterministic answer)                           | LLM-graded via mentor only                                                                     |
| `match_pairs`         | `{ left[], right[] }`              | `{ pairs: [[l,r]] }`                                     | Partial credit                                                                                 |

`speak_repeat` grading has an explicit rule that matters: **a low-confidence transcript is never
recorded as a mistake.** ASR failure and learner failure are different events, and confusing them
teaches the learner to distrust both the product and their own pronunciation.

`normalization` is optional per exercise and overrides the language profile only to _loosen_
(tighter normalization requires a reviewer note). This prevents one exercise from silently
enforcing stricter accents than the language standard.

---

## Validator rules (CI: `pnpm content:validate`)

Schema errors block merge. Semantic rules run in this order:

1. **Schema** — all files validate against Zod-generated JSON Schema.
2. **Referential integrity** — every referenced `concept_key`, `unit_slug`, `course_slug`, and
   `audio_ref` exists; no dangling `prerequisites`.
3. **Acyclic prerequisites** — topological check on the concept graph; cycles fail.
4. **Pedagogical ordering** — within a course, `introduce` MUST precede `practise`/`assess` for
   the same concept. This is the mechanical guarantee that the curriculum progresses logically,
   and it is checked by a topological sort over lessons, not by review.
5. **Level discipline** — an exercise MUST NOT reference a concept above its lesson's CEFR
   level, and MUST NOT assess a concept that is never introduced anywhere in the pack.
6. **Vocabulary budget** — new lemmas per lesson ≤ 12; distinct lemmas per unit ≤ 60. Automated
   difficulty guard against an author who writes a beautiful but unlearnable lesson.
7. **Answer validity** — `accepted_answers` non-empty; `mcq` has exactly one correct option;
   `reorder_tokens.correct_order` reconstructs `tokens`; `fill_blank` blank count matches answer
   groups; `match_pairs` ids align.
8. **Language correctness** —
   - target text is written in the declared script (Unicode range check);
   - native text is NOT in the target script (catches copy-paste errors);
   - target text is not left in the `native` field of examples;
   - transliteration present wherever `transliteration_required` is true.
9. **Content policy** — forbidden terms, profanity policy, age rating.
10. **Length caps** — `explanation_md` ≤ 1,200 chars; examples 3–8 per concept; `summary_short`
    ≤ 160 chars.
11. **Audio manifest** — reports which `audio_asset` hashes are missing or stale so CI generates
    exactly the changed lines, not the whole pack.

Rules 4, 5, 6, and 8 are the ones that catch real authoring bugs. They exist because content
scale is the bottleneck and reviewers cannot hold a whole pack in their heads.

---

## Publish pipeline

```
PR to content/ ─► content-validate.yml ─► CODEOWNERS review (1 native speaker + 1 curriculum)
        │
        ▼ merge to main
publish job (apps/worker):
  1. read pack.yaml, compute import_checksum — skip if unchanged
  2. create/update content_pack row; bump version
  3. validate MAJOR-version migrations block; abort if missing
  4. upsert languages, courses, units, lessons, concepts, exercises (idempotent by slug)
  5. mark removed rows status='deprecated'  (never delete)
  6. enqueue audio pre-generation for the missing/stale hashes only
  7. invalidate catalog ETags
  8. write audit_log
```

The import is idempotent and keyed on `pack_key` + slug, so re-running is always safe. Import
never deletes: content that disappears becomes `deprecated` and keeps its learner progress rows
intact.

Audio is generated **at publish**, not at runtime. A pack's lesson audio is a one-time cost per
pack rather than a per-learner cost, which is the difference between viable and not at scale.

---

## Contribution workflow

1. Fork, branch `content/es-a1-past-tense`.
2. Add pack files; run `pnpm content:validate --pack en-es-a1` locally.
3. Open a PR using the **content** template (what it teaches, why at this level, what it
   assumes the learner knows).
4. CI runs the validator. `content/**` requires **two approvals**: one from `CODEOWNERS` for the
   target language directory (must be a fluent or native speaker) and one from curriculum.
5. DCO sign-off is required; contributors retain copyright and license their contribution under
   the pack's content license.
6. Merge triggers publish. A `content_report` reaching `resolved` files an issue back to the
   pack author automatically.

Reviewers are the real constraint at scale. A language pack without a fluent reviewer is not
publishable, so the reviewer roster is a first-class part of the contribution process, not an
afterthought.

## Versioning summary

| Change                               | Bump  | Learner impact                                       |
| ------------------------------------ | ----- | ---------------------------------------------------- |
| Typos, wording, audio re-render      | PATCH | None                                                 |
| New lessons/exercises/concepts       | MINOR | None; new content appears                            |
| Concept rename/removal, unit reorder | MAJOR | `migrations` block required; mastery carried forward |

## Open questions for review

1. **Native-speaker review at scale.** Two approvals per content PR is right for quality and
   will be a bottleneck. Do we accept a single fluent reviewer plus a post-publish report queue
   for non-core packs? This is a real fork in contributor experience.
2. **`speak_repeat` at A0.** Requiring microphone input in lesson 1 will cost some beginners.
   Should the first unit be speak-optional with an explicit opt-in?
3. **Transliteration policy for non-Latin packs.** `transliteration_required` per language is
   blunt — Japanese learners want romaji early and hate it later. Consider a per-CEFR policy
   instead of per-language.
