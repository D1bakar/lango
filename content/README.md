# content

Language packs: the authored curriculum, as data.

**This directory is licensed CC BY-NC-4.0, not Apache-2.0.** See
[`LICENSE`](./LICENSE) here and the split explained in
[ADR-0006](../docs/architecture/adr/0006-apache2-code-ccbync-content.md).

## What a language pack is

A pack teaches one **language pair** at one CEFR range — for example English
speakers learning Spanish at A1. It contains the courses, units, lessons,
concepts, exercises, and examples, plus the mentor guidance that keeps the AI
tutor aligned with what the lesson is actually teaching.

Packs are authored for a _pair_ rather than a target language alone, because the
explanations and the mistakes a learner makes are specific to their native
language. "Spanish for English speakers" and "Spanish for Japanese speakers" are
different content, not the same content translated.

## Layout

```
languages/       shared per-language definitions (script, direction, morphology)
normalization/   grading rules per language (accents, script folding, width)
packs/
  en--es/        native -- target
    a1/
      pack.yaml
      courses/
      units/
      lessons/
      concepts/
      exercises/
```

Currently seeded with the `en-es-a1` pack only: one worked reference that proves
the format. Every other language arrives as a community contribution.

## The full specification

Read [`docs/architecture/06-language-pack-spec.md`](../docs/architecture/06-language-pack-spec.md).
It defines every file, every field, the twelve exercise types, the eleven
validator rules CI enforces, and the publish pipeline.

The rule that surprises reviewers most: **the validator runs a topological sort
over concept prerequisites and lesson roles.** A learner can never be assessed on
a concept that was never introduced, in any pack, without a human noticing. That
check is mechanical because reviewers cannot hold a whole pack in their heads.

## Contributing a pack

1. Read the spec above, and `CONTRIBUTING.md` for the process.
2. Author under `packs/{native}--{target}/{cefr}/`.
3. Run the validator: `pnpm content:validate --pack en-es-a1` (lands with the
   content validator in Phase 3.5).
4. Open a pull request. It needs **two approvals**: one from a fluent or native
   speaker of the target language, and one from curriculum review.

Also required:

- **DCO sign-off** on every commit (`git commit -s`).
- **Original content.** Do not copy from textbooks, course material, or another
  app. Authored text only; cite sources for anything factual.
- **Every file carries the CC BY-NC-4.0 header.** CI enforces that the license
  boundary holds and that no source file imports from this directory.

## Why the license is different here

The code is a commodity. The curriculum is not: it is the expensive part to
produce and the part a competitor cannot replicate quickly. CC BY-NC keeps it
available to learners and contributors while reserving commercial use.

This does mean packs are not "open source" in the OSI sense. That is a
deliberate, documented trade-off — including its cost, which is that some
contributors and employers will decline to take part. See ADR-0006 for the
reasoning and the conditions under which we would revisit it.

## Wrong content is a bug

A wrong translation teaches a wrong habit, and the learner cannot detect it.
File a **content error** issue: it is triaged ahead of feature work, and a
resolved report files an issue back to the pack author automatically.
