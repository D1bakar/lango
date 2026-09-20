# ADR-0008 — Multi-language as data, with community-authored language packs

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

The founder's goal is a platform that supports many languages. The engineering reality is that
almost everything valuable in a language-learning product is **language-pair specific**:

- grammar explanations must be written for a specific native language, not translated;
- answer normalization differs fundamentally by language (Spanish accents are required, Japanese
  accepts kana for kanji at A1, Arabic short vowels are usually unwritten, Thai has no spaces);
- tokenization differs (whitespace vs CJK vs Thai);
- pronunciation feedback needs tone support for some languages and stress for others;
- error taxonomies differ (particles for Japanese, gender agreement for Spanish, counters for
  some languages);
- script and text direction affect every rendering surface;
- speech recognition accuracy on learner speech degrades differently per language and accent.

Authoring all of this for many languages at once is not an engineering problem — it is a content
problem with a cost proportional to language pairs times CEFR levels. Meanwhile, retrofitting
multi-language support into a single-language implementation is a rewrite of the schema, the
grading layer, the prompt layer, and the UI.

There is also a tempting shortcut: generate curriculum content with an LLM. Explanations would be
free and instant. They would also be unverified, of inconsistent quality, and sometimes wrong in
exactly the way that destroys learner trust.

## Decision

**Architecture is language-agnostic from day one. Content is one seeded pack plus community
packs.**

1. **No language-specific logic in application code.** Everything the engine branches on lives in
   `language` rows: `script`, `text_direction`, `tokenizer_profile`, `normalization_profile`,
   `morphology`, `transliteration_*`, and per-provider `tts_config` / `stt_config`. If a
   `if (language === 'es')` appears in application code, the model is wrong.
2. **Grading normalization is a language-level profile,** not generic code, because a single
   generic normalizer marks correct answers wrong in every language that has diacritics,
   non-Latin scripts, or no word spacing.
3. **Curriculum is authored per language pair** (`language_pair`, not just target language),
   because explanation quality is L1-specific. A curriculum is a `content_pack` keyed to a pair
   and a CEFR range.
4. **Content is YAML in the repo, validated in CI, reviewed by a fluent speaker.** One seeded pack
   (`en-es-a1`) is the reference implementation of the format. Everything else arrives as
   community packs through the contribution workflow in `06-language-pack-spec.md`.
5. **Error taxonomy core is language-agnostic** (a closed enum of `grammar_agreement`,
   `grammar_particle`, `pronunciation_tone`, and so on) with pack-defined `subcategory_key` for
   language-specific precision. Cross-language analytics and the mentor's "your recurring weakness
   is agreement" logic therefore work for every language for free, including ones we have not
   launched yet.
6. **Explanations shown to learners are authored and reviewed, never model-generated at runtime.**
   The mentor grounds in `concept.explanation_md` and is post-checked for ungrounded assertions.
7. **A mechanically enforced pedagogical ordering guarantee.** The validator runs a topological
   sort over the concept prerequisite graph and over lesson `introduce`/`practise`/`assess` roles,
   so a learner can never be assessed on a concept that was never introduced, in any pack, without
   a human noticing.

## Consequences

**Positive**

- **Language #2 costs content, not engineering.** Adding a pack is a validator run and a publish
  job, not a schema migration, a grading rewrite, or a prompt fork. This is the difference between
  a multi-language platform and a Spanish app.
- The architecture cost of this decision at MVP is small — a few extra columns and a YAML schema —
  whereas retrofitting it later is one of the most expensive rewrites available to this product.
- Community contribution becomes distribution. Contributors get a documented format, a validator
  that catches real mistakes, and a review path; we get language coverage we could never fund.
- Validator rules for ordering, level discipline, vocabulary budget, and script correctness catch
  the authoring bugs that reviewers cannot hold in their heads at scale.
- The error taxonomy generalizes, so the differentiator (the learner model) is immediately useful
  for a brand-new language on day one.

**Negative**

- **Reviewer availability is the hard bottleneck, not code.** Every pack needs a fluent or native
  reviewer. Two approvals per content PR is correct for quality and will throttle contribution.
  This is the main risk of the whole strategy.
- YAML-in-repo authoring is unfriendly to non-engineers. Curriculum experts will need Git, or will
  need an authoring UI we have chosen not to build yet. That is a real cost, and a real reason the
  content bottleneck might not actually be solved by this decision.
- Language-pair-specific authoring multiplies content cost. English→Spanish and Hindi→Spanish are
  separate packs; coverage does not compose.
- The pack format will surely be wrong somewhere for a language family we have not tried
  (agglutinative morphology, honorific systems, tonal scripts). The first non-Romance pack will
  force format changes.
- Every language adds an STT/TTS quality dependency. Recognition quality for learner speech varies
  substantially by language and accent, and some languages will simply work worse. We may ship a
  pack that is pedagogically fine and technically poor.
- Supporting multi-language behavior means every UI surface needs script, direction, and
  transliteration handling from the start, which is easy to forget in a component written while
  only Spanish exists.

## Alternatives considered

- **Single language, hardcoded.** Fastest to MVP and the lowest risk of shipping a broken second
  language. Rejected because the eventual product is multi-language and the retrofit cost is a
  rewrite of schema, grading, prompts, and UI. The architecture decision is cheap now and
  expensive later, which is the correct time to make it.
- **All languages at launch.** Rejected: content cost scales with pairs, and we would ship ten
  shallow, unreviewed courses instead of one good one. This is a Phase 0 error, not a Phase 1 one.
- **LLM-generated curriculum content.** Rejected: unreviewed grammar explanations shown to
  learners are a trust-destroying liability, and non-native speakers cannot audit them. Generation
  may assist draft authoring later, always behind human review — never the published path.
- **Translation of one master curriculum into every L1.** Rejected: translated explanations read
  as translation and miss the specific interference errors of each native language, which is where
  most of the teaching value lives.
- **Build an authoring CMS first and store content in the database.** Rejected for MVP: the review
  surface would be a web app we have to build, and content diffs in a CMS are invisible to
  reviewers. YAML in Git gives real review, real versioning, and real CI validation at zero build
  cost. Revisit if curriculum experts cannot work in Git.
- **A single generic answer normalizer.** Rejected outright: it produces wrong grades in Spanish,
  Japanese, and Arabic simultaneously.

## Review trigger

Revisit when the first non-Latin-script pack is authored (expect format changes for tokenization
and transliteration), if content PR review throughput becomes the binding constraint on language
coverage, or if an authoring UI becomes justified by contributor volume rather than ambition.
