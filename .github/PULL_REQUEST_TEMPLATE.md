<!--
Keep this focused. Reviewers need the why, the evidence, and the risk. They can
read the diff.
-->

## What and why

<!-- What changes, and why this way. Link the issue if there is one. -->

Closes #

## How

<!-- The approach, and anything a reviewer would otherwise have to reverse-engineer. -->

## Verification

<!-- How do you know this works? Name the commands and what you observed. -->

## Risk and rollout

<!-- What could break, who is affected, and can it be turned off? -->

---

## Checklist

**Required**

- [ ] `pnpm verify` passes locally (format, lint, typecheck, test)
- [ ] Commits are signed off (`git commit -s`) and use Conventional Commits
- [ ] Tests added or updated for behaviour changes; a bug fix includes a test that
      fails without the fix
- [ ] No secrets, credentials, tokens, or private URLs anywhere in the diff —
      including tests, fixtures, and comments
- [ ] No new dependency, or the description above justifies it (what it solves,
      what else was considered, how much of it we actually use)

**When applicable**

- [ ] Schema changed → noted above, with whether a migration is needed
- [ ] Touches prompts, model routing, or the AI layer → expected eval impact
      stated; the eval suite is the gate, not how the prompt reads
- [ ] User-facing strings → added as translation keys rather than inline text
- [ ] UI changed → keyboard navigable, screen-reader labels present, and it works
      at 360px width
- [ ] API changed → `packages/types` updated, and the contract in
      `docs/architecture/03-api-contracts.md` still matches
- [ ] Architecture decision changed → a new ADR supersedes the old one rather
      than editing an accepted record
- [ ] Any way for a client to obtain `answer_spec` or another learner's data?
      If yes, stop and say so above.

**Content pull requests only**

- [ ] Files carry the CC BY-NC-4.0 header; nothing under `content/` is imported
      as a module
- [ ] Content is original — not copied from a textbook, course, or another app
- [ ] A fluent or native speaker of the target language has reviewed it
      (`CODEOWNERS` for the language directory)
- [ ] Level discipline holds: nothing above the lesson's CEFR level, nothing
      assessed before it is introduced
