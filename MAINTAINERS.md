# Maintainers

> **Placeholders.** Every contact below must be replaced with a real, monitored
> address before this repository is published. An unmonitored security contact is
> worse than none, because it implies a response that will not arrive.

## Contacts

| Purpose                             | Contact                 | Notes                                                                      |
| ----------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| Security reports                    | `security@example.com`  | Private. Acknowledge within 3 business days. See `SECURITY.md`.            |
| Code of conduct                     | `conduct@example.com`   | Private. Reviewed by maintainers not involved in the report.               |
| Commercial licensing (`content/**`) | `licensing@example.com` | The curriculum is CC BY-NC-4.0; commercial use needs a separate agreement. |
| Everything else                     | GitHub discussions      | Prefer public where it is not sensitive.                                   |

## Roles

| Area               | Owns                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Architecture       | `docs/architecture/**`, `packages/types`, API contracts, ADRs                                             |
| Platform           | `apps/api`, `packages/config`, CI, dependency policy, deployment                                          |
| Curriculum         | `content/**` structure, level discipline, review standards                                                |
| Language reviewers | One owner per language directory under `content/packs/`. Must be fluent or native in the target language. |

## Current maintainers

| Name         | GitHub       | Area         |
| ------------ | ------------ | ------------ |
| _unassigned_ | _unassigned_ | _unassigned_ |

## Language reviewers

Content pull requests require an approval from the owner of the target language
directory in `CODEOWNERS`. Add one row per language.

| Language     | Owner        |
| ------------ | ------------ |
| en → es (A1) | _unassigned_ |

**A language pack without a fluent reviewer is not publishable.** That is the
constraint that decides how many languages we can honestly support, not the
number we would like to.

## Becoming a maintainer

Sustained contribution to an area, and review of others' work in it. Maintainers
are added by consensus of existing maintainers. Reviewer access to a language
directory is granted on demonstrated fluency and reliable review turnaround — a
reviewer who cannot respond holds up every contribution to that language, so
responsiveness matters as much as knowledge.

## After leaving

Move yourself to an emeritus list rather than removing the row, so it stays
clear who owned what and when. Ask for removal from `CODEOWNERS` and from any
repository secrets at the same time — access that outlives the relationship is
how credentials leak.
