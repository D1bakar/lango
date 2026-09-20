# 03 — API contracts

REST over HTTPS, JSON bodies, versioned prefix `/v1`. OpenAPI is **generated** from Zod schemas
in `packages/types`; the web client's types are generated from the same source. There is no
hand-written API type anywhere.

See ADR-0003 for why REST over GraphQL and tRPC.

## Cross-cutting rules

| Concern           | Rule                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth              | Short-lived access JWT (15 min, memory + `Authorization: Bearer`) + rotating refresh token in an httpOnly, Secure, SameSite=Lax cookie                                           |
| Idempotency       | Mutation endpoints that a client may retry (session start, attempt submit, tutor turn) require `Idempotency-Key`; replays return the original response with `409`-free semantics |
| Pagination        | Cursor-based only: `?limit=&cursor=`. Response `{ "data": [...], "next_cursor": "...", "has_more": bool }`. Never offset                                                         |
| Errors            | `application/problem+json` (RFC 9457): `{ type, title, status, detail, code, errors[] }` with a stable machine-readable `code`                                                   |
| Validation        | Shape errors → `400`; semantically valid but rejected → `422`. Never a bare `500` for user input                                                                                 |
| Rate limits       | Every response carries `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`. `429` includes `Retry-After`                                                                 |
| Quota exhaustion  | `402` with `code: "quota_exhausted"` — distinct from `429`. The client must distinguish "slow down" from "you are out of free voice"                                             |
| Timestamps        | ISO-8601 UTC                                                                                                                                                                     |
| IDs               | UUID v7 strings                                                                                                                                                                  |
| Language metadata | Any response containing target-language text for rendering includes `language: { tag, script, direction }` so the client sets `dir`/`lang` correctly                             |
| Caching           | Catalog and concept GETs: `ETag` + `Cache-Control: public, max-age=300, stale-while-revalidate=600`. Learner data: `no-store`. Audio: immutable, content-hash URL, CDN           |
| Request IDs       | `X-Request-Id` echoed on every response; present in logs and error payloads                                                                                                      |

### Error code registry

`unauthenticated` · `token_expired` · `forbidden` · `not_found` · `validation_failed` ·
`email_taken` · `invalid_credentials` · `email_not_verified` · `rate_limited` ·
`quota_exhausted` · `voice_quota_exhausted` · `audio_too_long` · `audio_too_large` ·
`audio_unsupported_format` · `transcription_low_confidence` · `provider_unavailable` ·
`session_not_active` · `content_version_conflict` · `feature_not_in_tier`

## Security principles baked into the contract

1. **`answer_spec` is never serialized to a client.** The lesson manifest returns prompts and
   payloads only. Grading happens server-side. This is non-negotiable: a client that can read
   the answer key makes the whole progress system worthless.
2. **Correct answers are returned only in the response to a submitted attempt** for that
   specific exercise, never in a bulk payload.
3. **Ownership is checked on every learner-scoped resource.** `user_id` is never read from the
   request body; it always comes from the verified token.
4. **Uploads are scoped and expiring.** Presigned URLs are single-use, TTL 300s, path-scoped to
   `u/{user_id}/`, with server-side content-type and size limits enforced after upload.
5. **Admin routes live under `/v1/admin`** with role gating, separate stricter rate limits, and
   `audit_log` writes on every mutation.

---

## 1. Auth — `/v1/auth`

| Method | Path                             | Body / notes                                                           |
| ------ | -------------------------------- | ---------------------------------------------------------------------- |
| POST   | `/auth/signup`                   | `{ email, password, native_language_id, ui_locale, timezone }` → `201` |
| POST   | `/auth/login`                    | `{ email, password }` → sets refresh cookie, returns access token      |
| POST   | `/auth/refresh`                  | cookie only → new access token + rotated refresh                       |
| POST   | `/auth/logout`                   | revokes the token chain                                                |
| POST   | `/auth/password/reset/request`   | always `202`, never reveals account existence                          |
| POST   | `/auth/password/reset/confirm`   | `{ token, password }`                                                  |
| POST   | `/auth/email/verify/request`     |                                                                        |
| POST   | `/auth/email/verify/confirm`     | `{ token }`                                                            |
| GET    | `/auth/oauth/:provider/start`    | `provider ∈ {google, apple}`                                           |
| GET    | `/auth/oauth/:provider/callback` |                                                                        |
| GET    | `/v1/me`                         | user + active learner profile summary                                  |
| PATCH  | `/v1/me`                         | `{ display_name?, ui_locale?, timezone? }`                             |
| DELETE | `/v1/me`                         | `202` — async erasure job; returns a job id                            |

Login and signup are rate limited per IP **and** per email (`5/15min`), with progressive delay.

## 2. Onboarding and placement

| Method | Path                                   | Notes                                                                                                                             |
| ------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/languages`                        | `[{ id, tag, english_name, native_name, script, direction, learner_count, packs_available }]`                                     |
| GET    | `/v1/languages/:tag/pairs`             | available target packs for a given native language                                                                                |
| POST   | `/v1/learner/languages`                | `{ target_language_id, native_language_id }` → creates/activates a profile                                                        |
| PATCH  | `/v1/learner/languages/:id`            | `{ cefr_self?, goal?, goal_note?, daily_minutes_target?, reminder_time? }`                                                        |
| POST   | `/v1/placement/attempts`               | → `201 { id, estimated_items, first_item }`                                                                                       |
| POST   | `/v1/placement/attempts/:id/responses` | `{ responses: [{ item_id, response, duration_ms }] }` → next items or `status: completed`                                         |
| POST   | `/v1/placement/attempts/:id/complete`  | → `{ inferred_cefr, recommended_course_id, starting_unit_id }`                                                                    |
| POST   | `/v1/learning-plan`                    | Deterministic server-side plan from assessment + goal + availability. **Not LLM-generated** — it must be testable and explainable |

## 3. Catalog

| Method | Path                        | Notes                                                                                                                                            |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/v1/catalog/packs`         | `?native=&target=&cefr=`                                                                                                                         |
| GET    | `/v1/catalog/courses/:id`   | course + units + lesson summaries. No exercises                                                                                                  |
| GET    | `/v1/catalog/lessons/:id`   | lesson manifest: exercise **items** with `prompt_md`, `payload`, `prompt_audio_url`, `order_index`. **Excludes `answer_spec`, `explanation_md`** |
| GET    | `/v1/catalog/concepts/:key` | concept detail: `summary_short`, `explanation_md`, `examples[]`. Powers the "why?" panel                                                         |

## 4. Learning

| Method | Path                      | Notes                                                                                                 |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| POST   | `/v1/sessions`            | `{ mode, lesson_id? }` + `Idempotency-Key` → `201 { session_id, ... }`                                |
| PATCH  | `/v1/sessions/:id/end`    | `{ reason }` → `204`                                                                                  |
| GET    | `/v1/lessons/:id/items`   | `?session_id=&count=` — server selects items, mixing due review items and previously failed exercises |
| POST   | `/v1/attempts`            | `{ session_id, exercise_id, exercise_revision, response, duration_ms, hint_used }`                    |
| POST   | `/v1/attempts/:id/report` | `{ reason, comment }` → content report                                                                |

`POST /v1/attempts` response:

```json
{
  "attempt_id": "…",
  "is_correct": false,
  "score": 0.0,
  "correct_answer": "…",
  "explanation_md": "…",
  "corrections": [/* Correction objects, see 04-ai-contracts.md */],
  "concept_updates": [
    {
      "concept_key": "es.ser_vs_estar.present",
      "state": "learning",
      "stability": 1.8,
      "due_at": "2026-09-23T08:00:00Z",
      "delta": "improved"
    }
  ],
  "next_items": [/* server-selected, avoids a round trip */]
}
```

`next_items` is returned inline so the lesson player does not need a second request per item.
That removes ~40% of round trips in the hot loop and matters on mobile networks.

## 5. Progress

| Method | Path                       | Notes                                                                                          |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/v1/progress/summary`     | `{ streak, minutes_this_week, lessons_completed, concepts_mastered, due_today, weak_areas[] }` |
| GET    | `/v1/progress/activity`    | `?from=&to=` — reads `activity_day` only                                                       |
| GET    | `/v1/progress/concepts`    | `?filter=weak\|due\|mastered&cursor=`                                                          |
| GET    | `/v1/progress/vocabulary`  | `?filter=due\|recent&cursor=`                                                                  |
| GET    | `/v1/progress/courses/:id` | per-unit completion for the current course                                                     |

## 6. Review (SRS)

| Method | Path               | Notes                                                                                                                                                 |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/review/due`   | `?limit=20` → concepts + vocab items, each with attached exercise items                                                                               |
| POST   | `/v1/review/grade` | `{ item_type, item_id, rating }` — explicit self-rating only for vocabulary flashcards; graded exercises update FSRS automatically via `/v1/attempts` |

## 7. AI mentor

| Method | Path                                 | Notes                                                                                                                                    |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/tutor/sessions`                 | `{ mode, target_language_id, lesson_id?, scenario_key? }` → `{ tutor_session_id, opening_message, remaining_voice_seconds, tier }`       |
| POST   | `/v1/tutor/sessions/:id/uploads`     | → `{ upload_id, presigned_url, expires_at, max_bytes, allowed_types }`                                                                   |
| POST   | `/v1/tutor/sessions/:id/turns`       | Text turn. `{ text }` → **SSE** stream                                                                                                   |
| POST   | `/v1/tutor/sessions/:id/voice-turns` | Voice turn. `{ upload_id, duration_ms }` → **SSE** stream                                                                                |
| GET    | `/v1/tutor/sessions/:id`             | transcript, cursor-paginated                                                                                                             |
| POST   | `/v1/tutor/sessions/:id/end`         | → `{ summary, corrections_count, concepts_touched, new_vocab, suggested_review }`                                                        |
| POST   | `/v1/tutor/messages/:id/audio`       | re-synthesize a mentor message (usually a cache hit)                                                                                     |
| GET    | `/v1/tutor/usage`                    | `{ voice_seconds_used, voice_seconds_limit, stt_seconds, turns, reset_at, tier }`                                                        |
| POST   | `/v1/realtime/token`                 | **Reserved for V1.** Returns a LiveKit room token for a tutor session. Reserved now so the client contract does not change when R1 lands |

### SSE event contract

`Content-Type: text/event-stream`. Events, in guaranteed order:

```
event: turn_start     { turn_id, model_id, prompt_version }
event: transcript     { text, confidence }                  -- voice turns only
event: token          { text }                              -- N times, in order
event: correction     { correction }                        -- 0..N times
event: vocabulary     { lemma, translation, cefr }
event: audio_ready    { url, duration_ms, voice_id }        -- may arrive after token stream ends
event: usage          { voice_seconds_remaining, tokens_in, tokens_out }
event: turn_end       { message_id, structured }
event: error          { code, message, retryable, fallback_available }
```

Guarantees the client may rely on:

- `turn_start` is always first; `turn_end` **or** `error` is always last.
- `token` events form the reply text in order; render immediately, do not wait for `turn_end`.
- `correction` events may arrive after the prose finishes. The UI MUST NOT block the reply on
  corrections.
- `audio_ready` may be absent (TTS failure or tier limit) — the turn is still valid as text.
- `usage` is emitted even on failure, and failed turns MUST NOT consume voice quota
  (`quantity = 0` is written to the ledger so the cost analysis stays honest while the learner
  is not charged).

`POST /v1/tutor/sessions/:id/end` returns a **deterministic** summary computed from stored data
(instantly, always accurate). An LLM-narrated version is generated asynchronously and fetched
later via `GET /v1/tutor/sessions/:id`. We never make a learner wait on prose generation.

## 8. Usage and quota

| Method | Path                | Notes                                |
| ------ | ------------------- | ------------------------------------ |
| GET    | `/v1/usage/current` | per-metric usage, limits, reset time |
| GET    | `/v1/entitlement`   | current tier and period              |

AI endpoints additionally return `X-Quota-Remaining-Voice-Seconds`.

Quota checks are **pre-flight** (Redis token bucket, fast reject with `402`) and **committed
post-turn** (actual measured seconds, written to the ledger). Pre-flight prevents overspend;
post-commit keeps the numbers true. A hard monthly cap exists to prevent a runaway from becoming
a billing incident.

## 9. Admin — `/v1/admin`

| Method         | Path                                                                    | Notes                                                 |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| GET/POST/PATCH | `/admin/packs`, `/admin/packs/:id`                                      | metadata and status                                   |
| POST           | `/admin/packs/:id/validate`                                             | runs the language-pack validator, returns a report    |
| POST           | `/admin/packs/:id/publish`                                              | bumps version, triggers audio pre-generation + import |
| GET/POST/PATCH | `/admin/units`, `/admin/lessons`, `/admin/exercises`, `/admin/concepts` | authoring                                             |
| GET            | `/admin/reports`                                                        | content reports queue                                 |
| PATCH          | `/admin/reports/:id`                                                    | triage                                                |
| GET            | `/admin/usage/cost`                                                     | cost dashboards: per day, per model, per provider     |
| POST           | `/admin/users/:id/suspend`                                              | writes `audit_log`                                    |

Every admin mutation writes an `audit_log` row in the same transaction.

## 10. Webhooks (reserved, not implemented)

`/v1/webhooks/payments` — path reserved so adding a payment provider later is additive. Payment
provider types MUST NOT leak into the domain schema (see `entitlement.external_*_id`).

## Status code summary

`200` ok · `201` created · `202` accepted (async) · `204` no content · `400` shape ·
`401` unauthenticated · `402` quota_exhausted · `403` forbidden · `404` not found ·
`409` conflict / idempotency mismatch · `410` gone (deprecated content) · `413` too large ·
`415` unsupported media type · `422` rejected · `429` rate limited · `500` internal ·
`503` provider unavailable

## Open questions for review

1. **Access token transport.** Bearer-in-memory + refresh cookie avoids CSRF entirely but
   complicates SSR; cookie-only is simpler but needs double-submit CSRF tokens. Recommendation:
   Bearer + refresh cookie, with SSR reading a server-side session on first paint.
2. **`402` for quota.** It is the correct semantic but is formally reserved for future use.
   Some proxies and clients handle it oddly. Confirm before we rely on it, otherwise use `403`
   with `code: quota_exhausted`.
3. **Voice turn rate limit.** Proposed `30 turns / 5 min` per user on top of the quota, to blunt
   automated abuse of the STT/TTS path.
