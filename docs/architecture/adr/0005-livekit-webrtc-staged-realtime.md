# ADR-0005 — WebRTC via LiveKit, with staged realtime (R0 → R1 → R2)

- **Status:** Accepted
- **Date:** 2026-09-20

## Context

Real-time voice is the differentiator, and it is the hardest part of the system. The end state
involves full-duplex conversation with barge-in, and eventually an AI video presence. We must
choose a transport and a staging plan now, because the transport choice constrains everything
downstream.

Real-time audio over a lossy network is a mature, solved, and surprisingly deep domain:
jitter buffers, packet loss concealment, Opus codec negotiation, acoustic echo cancellation,
sample rate conversion, device enumeration, and mobile browser quirks like autoplay policy and
audio focus. It is also a domain with a long tail of device-specific bugs that appear only in
production on real hardware.

Two extremes are available: build the audio path on raw WebSockets, or hand the whole loop to a
vendor's speech-to-speech API. Both are wrong for different reasons.

## Decision

**Transport: WebRTC, using LiveKit** (open source, self-hostable SFU) as the media layer.

**Staging: three explicit stages, and R0 is what ships in the MVP.**

- **R0 (MVP) — push-to-talk, one-way turns.** No persistent connection, no barge-in. Presigned
  upload to object storage → batch STT → streaming LLM (SSE) → sentence-chunked TTS → playback.
  Perceived latency target p50 ≤ 2.8s, achieved by streaming text tokens immediately while audio
  is still synthesizing, so the learner starts reading at ~1.2s and hears audio at ~2.4s. Text
  mode always available; a low-confidence transcript asks the learner to repeat rather than
  recording a mistake.
- **R1 (V1) — full duplex.** LiveKit room per session; a realtime agent worker subscribes to the
  audio track, runs VAD and semantic endpointing, streams STT partials, streams LLM tokens into
  streaming TTS, and publishes audio back. Barge-in cancels the LLM and TTS pipelines and
  truncates conversation history at the last _heard_ point. Target p50 turn latency < 1.0s.
- **R2 (V2) — visual presence.** A video track for an avatar, behind a feature flag, measured
  against a faceless control.

The API contract reserves `POST /v1/realtime/token` now so the client's shape does not change
when R1 lands. Session state lives in Redis, and realtime agent workers are stateless so any
worker can be killed safely.

## Consequences

**Positive**

- **R0 validates the core question at roughly 15% of R1's cost.** "Does spoken interaction
  improve learning" is answered before paying for duplex infrastructure, endpointing tuning, and
  barge-in complexity. If voice does not help, we learn that cheaply.
- WebRTC handles jitter, packet loss, echo cancellation, and codec negotiation. We do not write
  or debug any of it, and we do not own the long tail of device-specific audio bugs.
- LiveKit is open source and self-hostable, so cost is a deployment decision rather than a
  vendor's pricing page. The same transport carries video, so R2 is a track addition.
- The pedagogical layer — context, corrections, evals — is ours and stays provider-independent.
  Swapping STT or TTS providers is an adapter change, not a rearchitecture.
- A text-only path exists at every stage, so a provider outage degrades the experience instead of
  ending it.

**Negative**

- **R0's experience is materially worse than R1's.** Push-to-talk with a one-way turn is not a
  conversation; it is a drill. Some learners will find it clunky, and we accept that to keep the
  MVP honest.
- **R0's architecture is largely throwaway.** The upload-STT-TTS pipeline is not the R1 pipeline.
  We deliberately accept paying twice, because R0 is cheap and its purpose is to answer a
  question, not to be the final implementation.
- LiveKit is one more dependency and, at scale, either a bill (Cloud) or an operational burden
  (self-hosted SFU with TURN, regional capacity, autoscaling).
- Duplex voice is genuinely hard: endpointing thresholds that feel right for one learner
  interrupt another, barge-in requires truncating history at the last heard point or the model
  responds to words the learner never heard, and agent workers autoscale on concurrent sessions
  rather than CPU.
- `apps/realtime-agent` becomes a fifth deployable with its own latency-sensitive on-call story,
  and it is the component most likely to be the source of production incidents.

## Alternatives considered

- **Raw WebSockets carrying audio.** Rejected: we would reimplement jitter buffering, packet loss
  concealment, echo cancellation, and codec negotiation, and then own every device-specific bug.
  WebRTC exists because this is hard.
- **Vendor speech-to-speech end to end** (a realtime API that consumes audio and produces audio).
  Rejected as the architecture, though useful for a spike: it removes our ability to inject the
  LearnerContext, enforce the CEFR ceiling, produce structured corrections, or ground
  explanations in authored content. It would make the product a wrapper around someone else's
  tutor — the exact outcome this project must avoid. It also bundles model, STT, and TTS into one
  vendor decision and one cost curve.
- **Third-party video/avatar platform first.** Rejected: high cost and latency for unproven
  pedagogical value. Voice must earn the right to a face first.
- **Batch-only voice forever (skip R1).** Rejected: the product's central claim is natural
  interaction. If R0 proves voice helps, the turn-taking delay becomes the limiting factor on
  retention, and duplex is the fix.
- **R1 in the MVP.** Rejected: 8–12 engineer-weeks and real scaling risk, spent before the core
  hypothesis is tested. This is the single biggest scope mistake available to this project.
- **Twilio / Vonage programmable voice.** Rejected: telephony-shaped, higher per-minute cost, and
  a worse fit for browser-based interactive tutoring than WebRTC.

## Review trigger

Revisit if R0 shows voice adds no measurable learning value (then stop at R0 and reconsider R1
entirely), if LiveKit Cloud pricing or self-hosting burden becomes material, or at R2 if avatar
experiments fail to beat a faceless control.
