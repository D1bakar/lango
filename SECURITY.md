# Security Policy

Security is a first-class requirement here, not a hardening phase. This document
covers how to report a problem and what we already treat as in scope.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub's [private vulnerability
reporting](../../security/advisories/new) on this repository. If that is
unavailable, email the maintainers at the address in `MAINTAINERS.md`.

Please include: what you found, how to reproduce it, what you think the impact
is, and whether you have told anyone else.

What to expect:

| Stage                                            | Target           |
| ------------------------------------------------ | ---------------- |
| Acknowledged                                     | 3 business days  |
| Initial assessment                               | 10 business days |
| Fix or documented mitigation for critical issues | 30 days          |

We will credit you in the advisory unless you would rather we did not. Please
give us a reasonable window to ship a fix before publishing. We will not pursue
legal action against research conducted in good faith against your own account
on our own infrastructure.

## Scope

In scope, including things that are unusual elsewhere:

**Authentication and accounts**

- Session handling, token rotation, refresh-token reuse detection
- Account takeover, email verification bypass, password reset flaws
- Broken authorization: any way to read or modify another learner's data

**The answer-key boundary**

- Any way to obtain `answer_spec`, an explanation before submitting an attempt,
  or another learner's responses. Grading is server-side and the answer key is
  never serialised to a client; a bypass is a critical finding.

**AI-specific**

- Prompt injection that causes the mentor to break its constraints, reveal its
  system prompt, invoke a tool outside the allowlist, or produce instructions
  unrelated to language learning
- Ways to make the mentor assert grammar rules that contradict authored content
- Any path that leaks another user's data into a model's context
- Cross-user prompt or session contamination

**Abuse and cost controls**

- Bypassing voice quota or rate limits, or driving unbounded provider spend
- Free-tier abuse: using the tutoring endpoint as a general-purpose LLM proxy
- Upload handling: oversized, malformed, or crafted audio that reaches a
  provider, or reaches another user

**Application**

- Injection, SSRF, XSS (model output is rendered, so it is an XSS vector),
  CSRF, insecure deserialisation, path traversal
- Secrets exposure: any credential reachable from the client, logs, error
  payloads, or the repository
- Dependency compromise, including in packages we allow to run install scripts

## Out of scope

- Denial of service by volume. We rate limit; we do not pay bounties for floods.
- Missing headers or best-practice findings with no demonstrated impact,
  including reports generated only by a scanner.
- Social engineering, phishing, or physical access.
- Anything requiring a compromised device or a rooted client.
- Vulnerabilities in third-party services we do not control. Report those
  upstream; tell us too if they affect us.
- The accuracy of AI-generated explanations. That is a product quality issue —
  please file a content error instead, where it will actually get triaged.

## How we handle secrets

- **Nothing secret is ever committed.** No API keys, tokens, passwords,
  connection strings, or private URLs in the repository, in tests, in fixtures,
  in seed data, or in commit history.
- Configuration is read from the environment and validated at startup by
  `packages/config`. A missing secret fails the process at boot with a readable
  message rather than at the first request with a stack trace.
- `.env.example` documents variable names and placeholder values only.
- Secrets are scoped per environment and rotate on exposure. If a credential
  reaches a commit, rotate it first and clean history second — rotating is the
  fix, rewriting history is the tidy-up.

## Supply chain

- Dependency install scripts are blocked by pnpm by default. Every exception is
  listed in `pnpm-workspace.yaml` under `allowBuilds` and must be reviewed and
  justified in the pull request that adds it.
- The lockfile is committed and CI installs with `--frozen-lockfile`.
- Dependency updates arrive as reviewable pull requests. No automatic merges.
- New dependencies need a justification in the pull request.

## Learner data and privacy

- Learner progress, mistakes, and transcripts are private by default. No
  feature may expose them to another user.
- Recorded audio is retained only as long as it is needed and then deleted;
  retention is enforced by an expiry column, not by a cleanup script that
  someone has to remember to run.
- We do not build voiceprints or speaker identification.
- Prompts are assembled from the minimum context needed for the turn. Personal
  identifiers are not included in model requests.
- Anything that touches minors, biometric data, or a learner's right to erasure
  needs review before merge, not after.

## AI-specific engineering rules

These exist because the usual web threat model does not cover them:

- Learner input is **data, never instructions**. It is delimited and declared as
  such, and inline instruction-like content is treated as a signal rather than
  obeyed.
- Model output is validated against a schema before use, sanitised before
  rendering, and never executed.
- Tools are allowlisted, schema-validated, argument-checked, and scoped to the
  authenticated user. There is no tool that can reach arbitrary SQL, the
  filesystem, or the network.
- Corrections that cannot be grounded in authored content are suppressed rather
  than shown.
- Every model call records cost, latency, model id, and prompt version, so abuse
  and provider problems are visible in data we already collect.
