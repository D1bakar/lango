# 02 — Data model

PostgreSQL 16+ (Neon), Prisma, `pgvector` for content retrieval. UUID v7 primary keys
(time-ordered, index-friendly); use Postgres `uuidv7()` where available, otherwise generate in
`packages/core`.

## Design rules

1. **Nothing assumes a specific language, script, or morphology.** All language-varying
   behaviour is data. If you are writing `if (language === 'es')` in application code, the
   model is wrong. See ADR-0008.
2. **Curriculum and learner state are separate halves.** Curriculum is authored, reviewed,
   versioned, and shared. Learner state is per-user, append-heavy, and private. They meet only
   through `concept.id` and `lesson.id`.
3. **Attempts are immutable facts.** Progress is derived from attempts, never overwritten.
   This makes content edits non-destructive.
4. **The error taxonomy is language-agnostic at the top level.** `category` is a fixed enum;
   pack-specific detail goes in `subcategory_key`. This keeps cross-language analytics and the
   mentor's "your recurring weakness is agreement" logic working for every language for free.
5. **Money and usage are recorded, not inferred.** `usage_ledger` is append-only.

---

## Part A — Languages and content

### `language`

Shared across all packs. Defines everything the engine must know to handle a language.

```
language
  id                    uuid pk
  bcp47_tag             text unique not null        -- 'es', 'pt-BR', 'zh-Hans'
  english_name          text not null
  native_name           text not null
  script                text not null               -- 'Latn','Cyrl','Deva','Jpan','Kore','Arab','Thai'
  text_direction        enum(ltr|rtl|ttb) not null default 'ltr'
  transliteration_scheme text                       -- 'pinyin','romaji','iso-233' | null
  transliteration_required bool not null default false
  tokenizer_profile     text not null default 'whitespace'  -- 'whitespace'|'cjk'|'thai'
  normalization_profile text not null               -- -> content/languages/<tag>.yaml
  morphology            jsonb not null default '{}' -- {gender:true, cases:4, counter_words:true, ...}
  tts_config            jsonb not null default '{}' -- per-provider voice ids + default rate
  stt_config            jsonb not null default '{}' -- biased vocab strategy, provider hints
  is_active             bool not null default true
  created_at / updated_at
```

`normalization_profile` is the grading contract for the language: accent sensitivity, diacritic
policy, case folding, script-insensitive comparison, accepted alternate scripts. Spanish grades
accents strictly; Japanese accepts kana for kanji at A1; Arabic treats diacritics as optional.
**This is the single most important multi-language hook in the schema** — grading cannot be
correct without it.

### `language_pair`

Explanations, translations, and error categories are L1-specific. A curriculum is authored for a
pair, not for a target language alone.

```
language_pair
  id           uuid pk
  native_id    uuid fk language not null
  target_id    uuid fk language not null
  is_active    bool not null default true
  unique (native_id, target_id)
  check (native_id <> target_id)
```

### `content_pack`

The unit of authoring, versioning, licensing, and community contribution.

```
content_pack
  id              uuid pk
  language_pair_id uuid fk language_pair not null
  pack_key        text unique not null        -- 'en-es-a1'
  title           text not null
  cefr_from       enum(A0..C2) not null
  cefr_to         enum(A0..C2) not null
  version         text not null               -- semver
  license         text not null               -- 'CC-BY-NC-4.0'
  status          enum(draft|in_review|published|deprecated) not null default 'draft'
  published_at    timestamptz
  import_checksum text                        -- hash of source YAML; skips no-op imports
  created_at / updated_at
  index (language_pair_id, status)
```

### `course`, `unit`, `lesson`

```
course    id, content_pack_id fk, slug, title, subtitle, cefr_level enum, order_index int,
          estimated_minutes int, status, version text
          unique (content_pack_id, slug)

unit      id, course_id fk, slug, title, summary, order_index int, estimated_minutes int,
          status, unique (course_id, slug)

lesson    id, unit_id fk, slug, title, lesson_type enum(concept_intro|practice|review|
          assessment|conversation), order_index int, estimated_minutes int,
          mentor_brief text,          -- instructions for the AI mentor about this lesson
          status, unique (unit_id, slug)
          index (unit_id, order_index)
```

`mentor_brief` is authored content, reviewed like any other. It is how the lesson and the mentor
stay aligned without the mentor guessing.

### `concept`

The atomic teachable unit — the thing that can be mastered, decay, and be remediated.

```
concept
  id                uuid pk
  content_pack_id   uuid fk not null
  key               text not null          -- stable: 'es.ser_vs_estar.present'
  kind              enum(grammar|vocab|pronunciation|pragmatics|orthography|listening)
  title             text not null
  summary_short     text not null          -- <=160 chars, always shown
  explanation_md    text not null          -- authored, reviewed, the grounding source
  cefr_level        enum(A0..C2) not null
  pronunciation_ipa text
  tags              text[] not null default '{}'
  metadata          jsonb not null default '{}'
  version           int not null default 1
  status            enum(active|deprecated) not null default 'active'
  unique (content_pack_id, key)
  index (content_pack_id, kind, cefr_level)
```

`explanation_md` is what the mentor is allowed to ground explanations in. It is authored and
reviewed, never model-generated. `version` increments on edit and is recorded on
`error_record` / `tutor_message` provenance so we can audit quality changes.

### `concept_prerequisite`

The ordering graph. Enables remediation ("you're failing X because Y was never mastered").

```
concept_prerequisite
  concept_id              uuid fk concept not null
  prerequisite_concept_id uuid fk concept not null
  strength                enum(hard|soft) not null default 'hard'
  pk (concept_id, prerequisite_concept_id)
  check (concept_id <> prerequisite_concept_id)
```

Validator rejects cycles in this graph at pack import.

### `lesson_concept`

```
lesson_concept
  lesson_id   uuid fk lesson not null
  concept_id  uuid fk concept not null
  role        enum(introduce|practise|assess|reinforce) not null
  order_index int not null default 0
  pk (lesson_id, concept_id)
  index (concept_id)
```

### `exercise`

```
exercise
  id                  uuid pk
  lesson_id           uuid fk not null
  order_index         int not null
  exercise_type       enum(mcq|multi_select|translate_to_target|translate_to_native|
                      reorder_tokens|fill_blank|type_answer|listen_select|listen_type|
                      speak_repeat|speak_free|match_pairs) not null
  prompt_md           text not null
  prompt_audio_id     uuid fk audio_asset
  payload             jsonb not null        -- shape depends on exercise_type
  answer_spec         jsonb not null        -- NEVER serialized to the client
  explanation_md      text not null         -- shown after grading, right or wrong
  difficulty          smallint not null default 3 check (difficulty between 1 and 5)
  revision            int not null default 1
  status              enum(active|deprecated)
  index (lesson_id, order_index)
```

`revision` increments on any edit to `payload`/`answer_spec`. `exercise_attempt` records the
revision it was graded against, so historical correctness stays interpretable after an edit.

### `exercise_concept`

Join table rather than a denormalized array — integrity first, materialized view later if the
weak-area query needs it.

```
exercise_concept (exercise_id, concept_id, weight real not null default 1.0) pk(exercise_id, concept_id)
```

### `content_example`, `audio_asset`

```
content_example
  id, concept_id fk, target_text, native_text, transliteration,
  audio_asset_id fk, register enum(formal|neutral|informal), tags text[], order_index int

audio_asset
  id            uuid pk
  storage_key   text not null
  text_hash     text unique not null      -- sha256(text + voice_id + provider + rate + format)
  text_content  text not null
  language_id   uuid fk language not null
  voice_id      text not null
  provider      text not null
  duration_ms   int not null
  bytes         int not null
  mime_type     text not null
  origin        enum(lesson_pregen|mentor_reply|user_upload)
  expires_at    timestamptz               -- set for user_upload; null otherwise
  created_at
  index (text_hash)
```

The `text_hash` unique index **is** the TTS cost control. Drill phrases, mentor openers, and
reprompts repeat heavily; a hit returns the stored file at zero marginal cost. User recordings
share this table with `origin='user_upload'` and an `expires_at` so retention policy is a query,
not a cron hunt through object storage.

---

## Part B — Learner identity and profile

### `user`, `oauth_account`, `auth_session`

```
user
  id, email citext unique, email_verified_at, password_hash (argon2id | null),
  display_name, avatar_url, ui_locale text not null default 'en', timezone text not null,
  role enum(learner|reviewer|admin) not null default 'learner',
  status enum(active|suspended|deleted), last_seen_at, created_at, updated_at, deleted_at
  index (status)
```

Single `role` column is an accepted MVP simplification. When a user needs two roles (a
contributor who is also a reviewer), introduce `user_role` — the migration is additive.

```
oauth_account     id, user_id fk, provider enum(google|apple), provider_account_id,
                  unique (provider, provider_account_id)
auth_session      id, user_id fk, refresh_token_hash, rotated_from_id fk auth_session,
                  user_agent, ip_hash, expires_at, revoked_at, created_at
                  index (user_id, revoked_at)
```

Refresh tokens rotate on every use. If a token with `rotated_from_id` already set is presented
again, the entire chain is revoked (reuse detection).

### `learner_language_profile`

Keyed per (user, target language) so adding a second target language is not a schema change.

```
learner_language_profile
  id                 uuid pk
  user_id            uuid fk not null
  target_language_id uuid fk language not null
  native_language_id uuid fk language not null
  cefr_self          enum(A0..C2)
  cefr_assessed      enum(A0..C2)
  goal               enum(travel|work|exam|family|media|other)
  goal_note          text
  daily_minutes_target smallint not null default 15
  reminder_time      time
  current_streak     int not null default 0
  longest_streak     int not null default 0
  streak_computed_at timestamptz
  is_active          bool not null default false
  onboarding_completed_at timestamptz
  created_at / updated_at
  unique (user_id, target_language_id)
  unique index (user_id) where is_active        -- one active target at a time
```

Streaks are **computed in the learner's timezone** by a nightly worker job, never incremented
inline. Inline streak updates are the classic bug that breaks streaks across timezones and DST.

---

## Part C — Learning state

### `enrollment`, `lesson_progress`

```
enrollment
  id, user_id fk, course_id fk, status enum(active|completed|paused|abandoned),
  current_lesson_id fk lesson, started_at, completed_at
  unique (user_id, course_id)

lesson_progress
  id                uuid pk
  user_id           uuid fk not null
  lesson_id         uuid fk not null
  pack_version      text not null      -- provenance: which content version was seen
  status            enum(available|in_progress|completed) not null default 'available'
  attempts          int not null default 0
  best_score        numeric(5,2)
  first_started_at, last_attempt_at, completed_at
  unique (user_id, lesson_id)
  index (user_id, status)
```

Locking is intentionally absent. The MVP derives availability from the course order at read
time rather than storing a `locked` row per learner per lesson. Storing locks means writing N
rows per enrollment and then reconciling them on every content edit.

### `study_session` (unifies lessons, tutor, review, placement)

```
study_session
  id, user_id fk, target_language_id fk,
  mode enum(lesson|tutor|review|placement|free),
  lesson_id fk lesson (nullable),
  device text, app_version text,
  started_at, ended_at, duration_seconds int,
  index (user_id, started_at desc)
```

Every attempt and every tutor session references a `study_session`, so activity, cost, and
duration have a single source of truth.

### `exercise_attempt` (append-only, high volume)

```
exercise_attempt
  id                uuid pk
  study_session_id  uuid fk not null
  user_id           uuid fk not null
  exercise_id       uuid fk not null
  exercise_revision int not null
  response          jsonb not null        -- the learner's raw input
  is_correct        bool not null
  score             numeric(5,2) not null -- supports partial credit
  duration_ms       int
  hint_used         bool not null default false
  graded_by         enum(deterministic|llm) not null default 'deterministic'
  created_at
  index (user_id, created_at desc), (exercise_id)
```

Partition by month at ~50M rows. Do not add analytics columns here; roll them into
`activity_day`.

### `concept_mastery` (FSRS state, one row per user per concept)

```
concept_mastery
  id                uuid pk
  user_id           uuid fk not null
  concept_id        uuid fk not null
  target_language_id uuid fk not null   -- denormalized for the "due now" query
  state             enum(new|learning|review|relearning|mastered) not null default 'new'
  stability         real not null default 0
  difficulty        real not null default 0
  due_at            timestamptz
  last_reviewed_at  timestamptz
  reps              int not null default 0
  lapses            int not null default 0
  correct_streak    int not null default 0
  total_correct     int not null default 0
  total_incorrect   int not null default 0
  fsrs_version      text not null
  unique (user_id, concept_id)
  index (user_id, target_language_id, due_at)   -- "what is due" — the hottest query
```

### `review_log` (append-only; required to re-fit FSRS parameters later)

```
review_log
  id, user_id fk, item_type enum(concept|vocab), item_id uuid, study_session_id fk,
  rating smallint not null check (rating between 1 and 4),  -- again|hard|good|easy
  state_before, elapsed_days int, scheduled_days int, reviewed_at
  index (user_id, reviewed_at desc), (item_type, item_id)
```

Without this you can never tune the scheduler on real data. It is cheap now and irreplaceable
later.

### `vocab_item`

Vocabulary is unbounded and tracked separately from concepts.

```
vocab_item
  id, user_id fk, target_language_id fk, lemma, normalized_lemma, pos,
  translation_native, concept_id fk (nullable), source enum(lesson|tutor|manual),
  state, stability, difficulty, due_at, reps, lapses, first_seen_at, last_seen_at
  unique (user_id, target_language_id, normalized_lemma)
  index (user_id, target_language_id, due_at)
```

### `error_record`

Feeds the mentor. This is the highest-value learner table in the system.

```
error_record
  id, user_id fk, target_language_id fk, concept_id fk (nullable),
  source enum(exercise|tutor_text|tutor_voice|placement),
  category enum(see taxonomy below) not null,
  subcategory_key text,              -- pack-defined: 'ser_vs_estar', 'por_vs_para'
  original_text     text not null,
  corrected_text    text not null,
  explanation       text,
  severity          smallint not null default 2 check (severity between 1 and 3),
  is_meaning_changing bool not null default false,
  study_session_id  uuid fk,
  exercise_attempt_id uuid fk (nullable),
  tutor_message_id  uuid fk (nullable),
  concept_version   int,
  created_at
  index (user_id, target_language_id, created_at desc)
  index (user_id, concept_id, created_at desc)
  index (user_id, target_language_id, category, created_at desc)
```

**Error taxonomy — language-agnostic core:**

```
grammar_agreement | grammar_tense | grammar_aspect | grammar_mood | grammar_word_order |
grammar_preposition | grammar_article | grammar_particle | grammar_pronoun | grammar_plural |
grammar_negation | grammar_comparison
vocab_wrong_word | vocab_missing_word | vocab_extra_word | vocab_register | vocab_false_friend
spelling | accent_or_diacritic
pronunciation_segment | pronunciation_stress | pronunciation_tone | pronunciation_intonation
fluency_pause | fluency_filler | discourse_connective
register_politeness | other
```

Some categories do not apply to some languages (tone for Spanish, articles for Japanese) — that
is fine and intended. The enum stays closed; `subcategory_key` carries the pack's own precision.

### `activity_day` (rollup, written by worker)

```
activity_day
  id, user_id fk, target_language_id fk, date date,
  minutes_learned int, lessons_completed int, exercises_attempted int, correct_count int,
  concepts_advanced int, tutor_voice_seconds int, tutor_turns int, xp int,
  unique (user_id, date, target_language_id)
  index (user_id, date desc)
```

Dashboard queries read this table only. Never aggregate `exercise_attempt` on a user request.

### `placement_attempt`

```
placement_attempt
  id, user_id fk, target_language_id fk, status enum(in_progress|completed|abandoned),
  responses jsonb,                  -- [{item_id, response, is_correct, difficulty}]
  inferred_cefr, inferred_start_unit_id fk unit, recommendation jsonb,
  started_at, completed_at
```

MVP uses fixed-form adaptive-lite (branching by difficulty band), not IRT. IRT is a research
project disguised as a feature.

---

## Part D — AI sessions

```
tutor_session
  id, study_session_id fk, user_id fk, target_language_id fk,
  mode enum(lesson_coach|free_conversation|roleplay|doubt_resolution|pronunciation_drill|
            placement),
  lesson_id fk (nullable), scenario_key text, cefr_ceiling enum,
  prompt_version text not null, model_config jsonb not null,
  status enum(active|ended|failed), started_at, ended_at,
  turn_count int, total_input_tokens int, total_output_tokens int,
  total_stt_seconds real, total_tts_characters int, total_cost_usd numeric(10,4),
  p50_turn_latency_ms int
  index (user_id, started_at desc)

tutor_message
  id, tutor_session_id fk, turn_index int, role enum(user|mentor|system_note|tool),
  content_text text, content_audio_asset_id fk,
  transcript_confidence real,
  user_audio_asset_id fk,             -- expires_at set; audio is not retained indefinitely
  corrections jsonb not null default '[]',   -- array of Correction (see 04-ai-contracts)
  tool_calls jsonb, structured jsonb,        -- the MentorTurnResponse emitted at turn_end
  tokens_in int, tokens_out int, model_id text,
  stt_ms int, llm_first_token_ms int, tts_ms int, total_ms int,
  safety_flags jsonb not null default '{}',
  created_at
  unique (tutor_session_id, turn_index, role)
  index (tutor_session_id, turn_index)
```

`model_id` and `prompt_version` are stored **per message**, not per session. This is what makes
it possible to answer "did quality drop after last Tuesday's prompt change" from real data.

```
eval_run     id, git_sha, prompt_version, model_id, suite, passed int, failed int,
             p50_first_token_ms int, cost_usd numeric(10,4), created_at
content_report
             id, reporter_user_id fk, exercise_id fk (nullable), concept_id fk (nullable),
             reason enum(translation_wrong|audio_wrong|explanation_unclear|offensive|other),
             comment text, status enum(open|triaged|fixed|wontfix), resolved_by fk user,
             created_at
audit_log    id, actor_user_id fk, action text, target_type text, target_id uuid,
             metadata jsonb, ip_hash text, created_at
             index (actor_user_id, created_at desc)
```

---

## Part E — Usage, metering, entitlement

```
entitlement
  id, user_id fk, tier enum(free|pro) not null default 'free',
  status enum(active|past_due|canceled),
  current_period_start date, current_period_end date,
  external_customer_id text, external_subscription_id text,   -- provider-agnostic
  unique (user_id) where status = 'active'

usage_ledger            -- append-only source of truth
  id, user_id fk, target_language_id fk,
  metric enum(voice_seconds|stt_seconds|tts_characters|llm_input_tokens|llm_output_tokens),
  quantity numeric not null, unit_cost_usd numeric(12,8), cost_usd numeric(12,6),
  provider text, model_id text, tutor_session_id fk (nullable),
  period_start date not null, occurred_at
  index (user_id, metric, period_start)
  index (period_start, metric)          -- cost dashboards

usage_counter           -- fast read model, incremented in Redis, flushed by worker
  id, user_id fk, metric enum(...), period_start date, quantity numeric not null,
  updated_at
  unique (user_id, metric, period_start)
```

Two tables on purpose. `usage_ledger` is the auditable truth for cost analysis; `usage_counter`
is the fast read for `GET /v1/usage/current` and quota checks. Quota enforcement reads Redis and
treats the counter as the fallback; a Redis loss degrades to a slightly stale check, never to
unlimited free voice.

---

## Content versioning rules

| Change                                   | Version bump | Learner impact                                                                                                                  |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Typo, wording fix, audio re-render       | PATCH        | None                                                                                                                            |
| New lesson/exercise/concept added        | MINOR        | None; new content appears                                                                                                       |
| Concept renamed/removed, units reordered | MAJOR        | Requires a `migrations` block in pack YAML mapping old `concept_key` → new, so `concept_mastery` and `vocab_item` carry forward |

MAJOR changes without a migration block MUST fail import. Silent loss of learner mastery is the
one content mistake users cannot forgive, because the app appears to forget their progress.

Removing content never deletes rows: `status='deprecated'`. `lesson_progress` and
`exercise_attempt` keep pointing at deprecated rows forever.

## Indexes worth calling out

| Query                                  | Index                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------- |
| What review items are due now          | `concept_mastery (user_id, target_language_id, due_at)`                 |
| This learner's recent mistakes         | `error_record (user_id, target_language_id, created_at desc)`           |
| Recurring weakness categories          | `error_record (user_id, target_language_id, category, created_at desc)` |
| TTS cache hit                          | unique `audio_asset (text_hash)`                                        |
| Active target language for a user      | partial unique `learner_language_profile (user_id) where is_active`     |
| Next exercises in a lesson             | `exercise (lesson_id, order_index)`                                     |
| Mentor context: mastered/weak concepts | `concept_mastery (user_id, concept_id)` + join to `concept`             |

## Open questions for review

1. **`concept` vs `exercise` granularity for pronunciation.** MVP has no phoneme scoring, so
   `pronunciation_*` categories are inferred from transcript only. Confirm that is acceptable
   for MVP before we write the grading rules.
2. **`cefr_ceiling` per learner vs per lesson.** Current design has both (lesson implies a
   level, learner has an assessed level). Confirm the mentor should be capped by the _lower_ of
   the two, not the assessed level alone.
3. **Retention default for `user_audio_asset`.** Proposed: 30 days, then delete the object and
   null the reference. Needs a decision from whoever owns privacy policy.
