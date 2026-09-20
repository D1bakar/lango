# 05 — Realtime R0 (voice, push-to-talk)

R0 is the MVP voice path: **one-way turns, no persistent connection, no barge-in.** It validates
whether spoken interaction improves learning before we pay for full-duplex infrastructure. See
ADR-0005 for the staged plan (R0 → R1 → R2).

## Sequence

```
Learner          web app                 api                  providers
  │                 │                     │                       │
  │ tap "speak" ───►│                     │                       │
  │                 │ POST /tutor/sessions/:id/uploads ─────────► │ (R2 presign)
  │                 │◄── presigned PUT ──────────────────────────  │
  │ record (opus,   │                     │                       │
  │ 16kHz mono,     │                     │                       │
  │ ≤30s)           │                     │                       │
  │ ──── audio ────►│ PUT direct to R2 ───────────────────────────►│
  │ tap "send" ────►│                     │                       │
  │                 │ POST /voice-turns ─►│                       │
  │                 │  { upload_id,       │ 1. verify ownership   │
  │                 │    duration_ms }    │ 2. validate size/type │
  │                 │                     │ 3. quota pre-check    │
  │                 │                     │ 4. STT ──────────────►│
  │                 │◄── event: turn_start│                       │
  │                 │◄── event: transcript (confidence)           │
  │                 │  ┌── if confidence < threshold ──┐          │
  │                 │  │ emit error low_confidence,    │          │
  │                 │  │ ask learner to repeat         │          │
  │                 │  └───────────────────────────────┘          │
  │                 │                     │ 5. build LearnerContext
  │                 │                     │ 6. LLM stream ───────►│
  │                 │◄── event: token ×N  │                       │
  │                 │◄── event: correction ×N                      │
  │                 │                     │ 7. TTS (per sentence) ►│
  │                 │◄── event: audio_ready                        │
  │                 │◄── event: usage, turn_end                    │
  │  ◄── plays audio│                     │                       │
  │                 │                     │ 8. persist messages,  │
  │                 │                     │    corrections,       │
  │                 │                     │    error_records,     │
  │                 │                     │    FSRS updates       │
  │                 │                     │ 9. enqueue ledger write
```

### Why direct-to-R2 upload

Audio never transits the API process. A 30s opus clip is ~60–120KB — small, but proxying it
through the API for every turn adds memory pressure and a bandwidth ceiling that scales with
concurrent speakers. Presigned PUT with a single-use, 300s TTL, path-scoped key keeps the API
process thin. The server still validates `Content-Type`, byte size, and duration **after**
upload, and rejects the turn if they do not match the declared values.

## Client state machine

```
idle ──tap──► capturing ──tap──► uploading ──► transcribing ──► thinking ──► speaking ──► idle
                   │                 │               │              │            │
                   └── cancel ───────┴───────────────┴──────────────┴─────► idle
                                                              error ──────► idle (retryable?)
```

Rules:

- The send button is disabled in every state except `idle`. One turn at a time in R0 — this is
  the whole point of R0: eliminate concurrent audio state.
- `capturing` auto-stops at 30s (hard cap) and at 2s of trailing silence (client-side VAD via
  AnalyserNode). Auto-stop is a UX nicety; it is not the security control.
- Playback can be interrupted by the learner at any time. That is client-side only: it stops
  audio, it does not cancel the server pipeline. **Server-side barge-in is R1.**
- `audio_ready` may never arrive (TTS failure). The turn still succeeds as text. The UI must
  have a designed text-only state, not a spinner that never resolves.

## Timeouts and hard budgets

| Stage           | Timeout | On timeout                            |
| --------------- | ------- | ------------------------------------- |
| Upload          | 15s     | Abort, free retry, no quota charge    |
| STT             | 8s      | Fall back to text input prompt        |
| LLM first token | 12s     | Retry once, then apology turn         |
| LLM full reply  | 20s     | Truncate at last complete sentence    |
| TTS             | 15s     | Emit turn as text-only                |
| Whole turn      | 45s     | Client-side hard abort, `error` event |

Every stage timeout must result in a **user-visible, actionable** state. No infinite spinners.

## Latency budget (R0 target: p50 ≤ 2.8s perceived)

| Stage                            | p50 target | p95 ceiling |
| -------------------------------- | ---------- | ----------- |
| Upload (60–120KB, 4G)            | 300ms      | 900ms       |
| STT (batch, ≤30s audio)          | 600ms      | 1500ms      |
| Context build (SQL only, no RAG) | 40ms       | 120ms       |
| LLM first token (cached prefix)  | 500ms      | 900ms       |
| LLM full reply                   | 1200ms     | 2500ms      |
| TTS first sentence audio         | 700ms      | 1500ms      |
| Network + decode                 | 150ms      | 400ms       |

The perceived-latency trick that makes R0 acceptable: **stream text tokens immediately, send
audio when the first sentence is synthesized.** The learner starts reading at ~1.2s and hears
audio at ~2.4s. Perceived responsiveness is set by the first token, not by the audio.

The context build is SQL-only. Learner state retrieval is a relational query, not RAG — no
vector search on the critical path. Content retrieval (RAG over authored grammar notes) happens
only for `doubt_resolution` mode and is served from a warm `pgvector` query with a hard 400ms
budget; on timeout the mentor answers from `concept.explanation_md` alone and flags lower
confidence.

## Prompt-prefix caching

The system prompt + `curriculum.concepts_in_focus` block is stable within a lesson. It is
constructed identically every turn so the provider's prompt cache hits. This is both a latency
win (first token drops materially) and the largest single input-cost reduction available. Cache
keys are asserted in an eval, because an accidental unstable field silently destroys the cache
and the cost regression is invisible without that test.

## Pre-generated audio

Lesson mentor openers, drill phrases, and reprompt templates are synthesized **at pack publish
time**, not per learner per turn. `audio_asset.text_hash` makes runtime lookup a hash query. This
turns a recurring per-user cost into a one-time per-pack cost, and it removes shell latency for
the most predictable utterances.

## Failure matrix

| Failure                               | Behaviour                                                                     | Quota                   |
| ------------------------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| Upload rejected (size/type/duration)  | `415` / `413` / `422`, actionable message                                     | Not charged             |
| STT provider down                     | `503 provider_unavailable`, client offers text input                          | Not charged             |
| Transcript confidence below threshold | `transcription_low_confidence`, ask learner to repeat                         | Not charged             |
| LLM failure                           | One retry, then a template apology turn that still asks a question            | Not charged             |
| TTS failure                           | Turn completes as text-only; `audio_ready` omitted                            | Charged STT + LLM only  |
| Quota exhausted mid-session           | `402 voice_quota_exhausted`; session continues in text mode                   | Voice not charged       |
| Redis unavailable                     | Fall back to `usage_counter` read; **fail closed** above the hard cap         | Conservative            |
| Client disconnects mid-turn           | Server completes and persists the turn; the learner sees it in the transcript | Charged (work was done) |

The rule behind the quota column: **we never charge for value we failed to deliver.** It costs
little and it is the difference between a cost bug and a trust bug.

## Abuse controls specific to the voice path

- Per-user voice rate limit (`30 turns / 5 min`) independent of the daily quota.
- Audio duration and byte caps enforced server-side after upload, not trusted from the client.
- One active `tutor_session` per user; opening a second ends the first.
- Upload keys are single-use and scoped to `u/{user_id}/`; a replayed `upload_id` is rejected.
- Uploaded audio is transcribed once and then deleted at `audio_asset.expires_at` (default 30
  days, pending the privacy decision in `02-data-model.md`).

## Observability

Metrics emitted per stage: `turn_started`, `stt_completed{confidence_bucket}`,
`llm_first_token`, `tts_completed`, `turn_failed{stage, code}`, `turn_completed{total_ms}`.

Three signals to watch continuously, because they are leading indicators of the two biggest R0
risks:

1. **`low_confidence` rate** — the ASR-quality canary. Rising values mean we are failing exactly
   the learners we built this for, and no error dashboard will tell you otherwise.
2. **TTS cost per session** — the unit-economics canary.
3. **`turn_failed{stage="tts"}`** — silent text-only degradation looks successful in logs and
   feels broken to learners.

## What R1 adds (for context, not built now)

Streaming STT partials, semantic endpointing, streaming TTS, server-side barge-in with pipeline
cancellation and history truncation at the last heard point, a persistent WebRTC connection via
LiveKit, and Redis-held session state. Target turn latency drops to p50 < 1.0s. The API contract
does not change — `/v1/realtime/token` is already reserved.

## Open questions for review

1. **Silence auto-stop threshold.** Proposed 2s trailing silence. Too short interrupts hesitant
   beginners; too long feels broken. Worth a user test before locking.
2. **Confidence threshold for `low_confidence`.** Needs calibration against real beginner audio
   before launch; start permissive and tighten with data.
3. **Max utterance length.** 30s is proposed for cost control. Confirm that is acceptable for
   the conversation-practice modes in the MVP.
