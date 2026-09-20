# ADR-0006 — Apache-2.0 for code, CC BY-NC for content, CLA required

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

The repository is public from the start, and the product must eventually be commercially viable.
Two very different assets live in this repo, and they have different economics.

Code is commodity in this product. The web app, the API, and the pipelines are meaningful
engineering, but they are not the moat — a funded competitor could rebuild them. What has real
value is the **authored curriculum** (concepts, explanations, exercise sets) and the **learner
model accumulated over time**. Content is also the part we want the community to help author,
because content scale is our stated bottleneck.

The contribution model depends on contribution friction, and licensing is a direct source of
friction. Getting this wrong in either direction is expensive: too permissive and a competitor
launders our curriculum into a commercial product; too restrictive and nobody contributes the
content we need.

## Decision

A split license, with the boundary enforced mechanically:

- **Code** (`apps/**`, `packages/**`, `.github/**`, tooling) — **Apache-2.0**. Permissive,
  OSI-approved, includes an explicit patent grant, and is uncontroversial for both individual and
  corporate contributors.
- **Content** (`content/**`) — **CC BY-NC-4.0**. Attribution required; commercial use of the
  authored curriculum is not permitted without a separate agreement. We retain full copyright as
  the project owner and are therefore not bound by the NC restriction ourselves.
- **A CLA is required** for all contributions, covering both code and content. Contributors keep
  copyright; we gain the right to relicense.
- **Boundary enforcement is automated:**
  - a license header check on every source file;
  - a CI job asserting that `content/**` carries the CC BY-NC header and nothing under it is
    imported as a code module;
  - a `LICENSE` and `content/LICENSE` file, with the split stated in the README;
  - DCO sign-off enforced on every commit.

Accepted trade-off, documented deliberately: **CC BY-NC is not an open-source license** and the
content is therefore not "open source" in the OSI sense, even though the code is.

## Consequences

**Positive**

- A competitor cannot take our curriculum commercial without an agreement. Our single most
  expensive-to-produce asset is protected.
- Apache-2.0 code removes the legal friction that stops engineers and companies from
  contributing or adopting, and its patent grant matters for a product this AI-heavy.
- The CLA keeps the business model open: we can relicense content (for instance to CC BY-SA, or
  to a commercial tier) later without tracking down every historical contributor.
- Contributors get clear, standard terms and keep their own copyright.
- A public repo is a hiring and credibility asset for a startup with no track record, and it
  forces us to keep the codebase legible.

**Negative**

- **The NC term works against the community-content strategy we chose.** Contributors who might
  want to reuse their own material commercially are deterred, many employers blanket-ban NC
  contributions, and the license splits the content ecosystem from permissively licensed
  language-learning projects we could otherwise share with. This is a real, accepted cost.
- CC BY-NC content makes the project ineligible for some open-source grants, directories, and
  packaging ecosystems.
- We now maintain two licenses, two header checkers, and a CLA process — real ongoing friction
  for a small team.
- A public repository means the architecture, the prompt strategy, and the ranking signals are
  visible to competitors. Accepted: our moat is accumulated content and learner data, not secrecy.
  Anything genuinely sensitive (model weights, tuned prompt parameters, cost data) stays out of
  the repo.
- The CLA adds a step to every contribution and will cost us some casual contributions.

## Alternatives considered

- **MIT / Apache-2.0 for everything.** Rejected: would allow a competitor to commercialize the
  curriculum directly, which is the main asset we are protecting.
- **AGPL-3.0 for code.** Rejected: effectively blocks hosted clones, but it is the single most
  reliable way to scare off contributors, corporate adoption, and investor diligence. If a clone
  becomes a real problem, the answer is product velocity, not a license.
- **CC BY-SA-4.0 for content.** The strongest alternative and genuinely tempting: it is
  OSI-friendly, allows commercial reuse, protects against proprietary forks via share-alike, and
  removes the contribution friction described above. Rejected for now because we cannot rule out
  commercializing content directly later, and the CLA keeps this reversible.
- **No license at all / private repo.** Rejected by the founder's choice and by the value of a
  public repo for hiring and credibility.
- **Proprietary content with no contribution path.** Rejected: content scale is the bottleneck,
  and community packs are the only realistic way to cover many languages.
- **DCO instead of a CLA.** Rejected: DCO preserves contributor copyright strictly and does not
  grant relicensing rights, which we need for the content licensing decision to be reversible.

## Review trigger

Revisit if: contributions are materially suppressed by the NC term (measurable as PR volume per
100 stars versus comparable projects), if a commercial content partnership requires
commensurately different terms, or before accepting a large corporate contribution whose legal
team objects to the CLA.
