# Contributing

Thanks for considering a contribution. This document is the contract for how
work happens here; if something in it is wrong or missing, that is a bug worth
reporting.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

Node.js 22 and pnpm, pinned through corepack:

```bash
corepack enable
pnpm install
pnpm verify
```

`corepack enable` is required, not optional: `turbo` shell-outs to the package
manager, so pnpm has to be on `PATH`.

`pnpm verify` runs formatting checks, lint, typecheck, and tests. CI runs the
same pipeline, so a green local verify means a green pull request.

## Repository layout and where code goes

```
apps/api/          HTTP server. Orchestration and authorization only.
packages/config/   runtime environment validation
packages/types/    Zod schemas. Imports nothing from this repository.
content/           language packs
docs/architecture/ design documents and ADRs
```

Dependency direction is enforced by lint, not by convention:

- `packages/types` imports nothing from this repository. It is the shared
  vocabulary and sits at the leaf of the graph.
- `packages/core` (when it exists) holds domain logic and must not import a web
  framework or a database driver. It has to be unit-testable without a server.
- `apps/web` (when it exists) may not import `db` or `ai`. The client consumes
  the API contract.
- Provider SDKs are imported only inside adapter modules, never in a route
  handler. Swapping an AI provider must be a config change.

If you find yourself wanting to break one of these rules, that is a design
conversation — open an issue instead of adding an exception.

## Branches

Trunk-based development. `main` is always deployable.

- Branch from `main`, keep the branch short-lived, open a pull request.
- Branch names: `feat/…`, `fix/…`, `chore/…`, `content/…`, `docs/…`.
  Example: `content/es-a1-past-tense`.
- Squash-merge into `main`. Delete the branch.
- Work that is not finished goes behind a feature flag, not on a long-lived
  branch.

**There is deliberately no `develop` branch.** With a small team, a long-lived
integration branch produces merge pain and a branch that is permanently behind
reality, while adding a second place for a release to be wrong.

## Commits

Conventional Commits, enforced by commitlint in CI:

```
<type>(<scope>): <subject>

<body — why, not what>

Signed-off-by: Your Name <you@example.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`. Scopes are listed in `commitlint.config.mjs`.

Write the subject as the reason for the change, not a description of the diff.

Good:

```
feat(progress): track concept mastery with FSRS scheduling
fix(api): cancel TTS when a learner interrupts playback
refactor(types): move register enum next to the concept it belongs to
docs(content): document how to add a language pack
content(es-a1): rewrite estar vs ser examples for clarity
```

Rejected by review, even though commitlint accepts them:

```
update
fix stuff
final changes
wip
```

## Pull requests

The template asks for the things reviewers actually need. In short:

- CI green: format, lint, typecheck, test.
- At least one approval. CODEOWNERS decides who that is.
- Tests for behaviour changes. A bug fix gets a test that fails without the fix.
- Schema change? Say so, and say whether it needs a migration.
- Touching prompts, model routing, or the AI layer? Note the expected eval
  impact. Prompt changes are gated on the eval suite, not on how they read.
- No secrets. Ever. See `SECURITY.md`.
- Sign off your commits: `git commit -s`.

## Code standards

- **TypeScript strict.** `strict`, `noUncheckedIndexedAccess`, and
  `verbatimModuleSyntax` are on. Use `import type` for type-only imports.
- **No `any`.** Lint rejects it. Use `unknown` and narrow.
- **Schemas are the source of truth.** A shape that crosses a boundary (API,
  content file, AI output, environment) is defined once in `packages/types` and
  the TypeScript type is derived with `z.infer`. Hand-writing a parallel type is
  how contracts drift.
- **Do not add a dependency for something the platform already does.** Justify
  new dependencies in the pull request: what it solves, what else was
  considered, how much of it we use. See ADR-0003 for an example of this
  reasoning.
- **Comments explain why.** The code already says what.
- Prefer the smallest correct change. No speculative abstraction, no
  configuration that nobody sets, no optimization without a measurement.

## Testing

- Unit tests live next to the code as `*.test.ts` under `__tests__/` or beside
  the module.
- Domain logic must be testable without a database or a network. That is the
  point of `packages/core`.
- Do not test framework internals. Test the contract: given this input, does our
  behaviour hold?
- Tests that assert a security property are especially welcome — for example,
  that a lesson payload never carries the answer key.

## Contributing a language pack

Content is a first-class contribution, not an afterthought. Read
`docs/architecture/06-language-pack-spec.md` for the format: languages, packs,
units, lessons, concepts, and exercises.

```bash
pnpm content:validate --pack en-es-a1     # available once the validator lands
```

What reviewers look for:

- **Correctness of the target language.** This is the whole job. A wrong
  translation is a product bug that teaches a wrong habit.
- **Level discipline.** Nothing above the lesson's CEFR level, nothing assessed
  before it is introduced anywhere in the pack. The validator enforces what it
  can; reviewers cover the rest.
- **Native-language interference.** Explain the mistake _this_ native language
  tends to cause. Translated explanations read as translations and teach less.
- **Explanations, not answers.** The learner should be able to see why.
- **Original content.** Do not paste from textbooks, course material, or another
  app. Authored text only, and cite your sources for anything factual.

Content pull requests require two approvals: one fluent or native speaker of the
target language (see `CODEOWNERS`), and one curriculum reviewer. Every
`content/**` file carries the CC BY-NC-4.0 license header; CI enforces the
boundary between content and code.

## Sign-off and licensing

Every commit needs a `Signed-off-by` line:

```bash
git commit -s -m "content(es-a1): add the past tense unit"
```

The [Developer Certificate of Origin](https://developercertificate.org/) means
you have the right to submit the work and you agree to it being distributed
under this project's licenses. CI rejects commits without it.

Submitting a contribution also means agreeing to the project's Contributor
License Agreement, which grants the project the right to relicense content. You
keep the copyright to what you write. This is what keeps the content license
reversible — see ADR-0006. The CLA is currently handled by asking maintainers to
record your acceptance in the pull request; a bot will replace this once
external contributions begin.

## Reporting bugs and requesting features

Use the issue templates. The **content error** template is the fastest path for
anything wrong inside a language pack, and it is triaged ahead of feature work,
because a wrong answer in a lesson costs us the learner's trust immediately.

Security issues do not go in the issue tracker. See `SECURITY.md`.
