# WingBuddy — Hackathon Plan (Combined, v3: client + server)

**One-line pitch:** An AI voice agent that bridges a Hindi-speaking distressed traveler, a remote English-speaking family member, and the airline — translating, advocating, and keeping everyone in the loop in real time.

**Stack:** Next.js (App Router) + TypeScript + Tailwind, `@vocalbridgeai/react`. Sabre mocked behind a clean interface. Apple-standard design system. Distress-first, low-friction access.

**This file supersedes the previous PLAN.md and the FastAPI-era CLAUDE.md. CLAUDE.md has been rewritten to match — Claude Code must never see two architectures.**

---

## Spike Verdicts (server build)

- **Spike A — shared-room 3-way: ❌ NOT available via VB's token API.** `POST https://vocalbridgeai.com/api/v1/token` ignores a caller-supplied `room_name` and returns a per-user room (`user-<u>-agent-<a>-api-<k>`). Two participants get two rooms — they cannot share one. **→ Use relay mode** (joiner types → `family_message` event → the hosted agent voices it to the traveler in Hindi). Relay ships regardless; the client dev should not build a shared-room "Join Call". (If true audio 3-way is ever needed, it requires a VB feature we don't have — out of scope.)
- **Spike B — Hindi end-to-end: PENDING (browser+mic).** Server side is ready: VB agent `WingBuddy` (id `bc498d9b-…`) configured with STT `hi`, TTS `eleven_multilingual_v2`, Hindi prompt + disclosure greeting, client-actions, and Bring-Your-Own-Agent (verbatim) delegating to `/api/agent`. Token mint verified live (HTTP 200). The one live utterance round-trip needs the client + a mic — validate in the browser.
- **Sabre — S0 auth + S2 flight data: ✅ REAL (cert).** `SABRE_HACKATHON_ACCESS_TOKEN` is a valid **cert-environment** bearer (prod hosts 401; cert hosts authenticate). Entitled to **InstaFlights** shopping — `seedFlight` pulls a real carrier/number/scheduled-departure from Sabre (verified live: B6 3988 JFK→LAX). Base: `https://api-crt.cert.havail.sabre.com`. **S1/S3 (PNR read + WCHR write): not entitled on this token (no booking scope)** → SSR stays session-local; the demo drop/re-add climax runs against our session state via `/api/demo/disrupt`, not Sabre. Gate/live-status aren't in shopping data (gate defaults; disrupt supplies changes).
- **Real integrations wired:** Anthropic translate (claude-haiku-4-5) ✅ live; Vocal Bridge token mint ✅ live; Sabre real flight seeding ✅ live. (Cert bearer tokens expire — refresh `SABRE_HACKATHON_ACCESS_TOKEN`, or add mint-from-username/pass+PCC later for auto-refresh.)

---

## 1. Locked Decisions (amended)

| Decision            | Choice                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| App structure       | One Next.js app. Role by route + token `role` param → same `room_name` → 3-way.            |
| **Hosting**         | **Cloud Run, `min-instances=1`** (single warm container → in-memory session store is safe). Alternative: Vercel + Upstash/Vercel KV — NEVER in-memory Map on Vercel serverless. |
| Hero demo story     | Trialogue + live translation + human-in-loop interrupt + **live disruption climax**. Sabre mocked entirely. |
| **Disruption beat** | Presenter presses `d` → gate change + wheelchair SSR **silently drops** → agent notices, re-adds, tells Mom calmly → badge ✓→⚠→✓ on both UIs. This is the demo's gasp moment. |
| **Real-time sync**  | **Two paths.** VB data channel for what VB natively provides (transcripts, agent actions, presence). **Server event log + 1.5s client poll** as the reliable backbone for server-initiated events (disrupt, relay) and late-joiner replay. No custom WebSocket. |
| Airline "call"      | **Default: narrated sub-state cards** ("🔄 Calling airline (0:14 hold)" → "♿ confirmed"). 4th-participant mock VB agent is a stretch spike only. |
| **3-way fallback ladder** | Room-join (Spike A) → **relay mode** (joiner types, agent voices it to Mom in Hindi) → `?demo=1`. Relay ships regardless. |
| Demo resilience     | `?demo=1` scripted fallback for transcript + status.                                       |
| Mic fallback        | Tap-to-talk if auto-grant fails.                                                           |
| Access model        | Signed link via share sheet (WhatsApp/SMS). PIN opt-in/off. Manual `/join` fallback kept.  |
| **Consent/AI disclosure** | Spoken, in the agent's Hindi greeting: AI identity + "your family can see our conversation." |
| **Medical guardrail** | No medication/symptom/dosing advice ever. Logistics only: facilities lookup + offer to notify family. |
| Speaker attribution | LiveKit participant identity → labels. Fallback: SDK transcript `role`.                    |
| Terminology         | Role-neutral: "Request help" / "Join a call".                                              |
| Styling             | Tailwind + shared design tokens; Apple HIG.                                                |
| Sabre               | Mock-first behind clean interface; never live for demo.                                    |
| Joiner voice entry  | Observe first → explicit "Join Call" tap enters 3-way.                                     |

---

## 2. Routes (pages)

```
/                       → landing: Request help | Join a call
/help                   → requester one-tap voice UI + live status cards + Share
/room/[sessionId]?t=…   → joiner dashboard (signed-link access): bilingual transcript + cards + Join Call
/join                   → manual code + PIN fallback
```

---

## 3. Client-Side Architecture (summary — UX specs in §6)

- Requester client (`/help`): creates the session on load, mints its voice token, connects mic→VB over WebRTC, renders transcript + cards. It is also the **bridge for server-initiated agent speech**: it polls the event log and converts `family_message` / `flight_update` events into **app→agent client actions** on the data channel, which the agent reacts to (speaks to Mom / re-checks the booking). This is the SDK-documented mechanism; no unverified server→agent path is used.
- Requester client forwards each final transcript line to the server (`POST .../transcript`) so the server can translate + log it for the joiner and for replay.
- Joiner client (`/room/[id]`): hydrates from `GET .../state`, then polls `GET .../events?since=seq` every 1.5s. If Spike A passes, "Join Call" mints a joiner voice token into the same room.

---

## 4. Server-Side Plan (NEW)

All server code is Next.js route handlers + `lib/` modules in the same deploy. TypeScript throughout.

### 4.1 API surface — existing vs new

| # | Endpoint | Status | Purpose |
|---|---|---|---|
| 1 | `POST /api/session` | **existing** (spec'd in v1 §8.2) | Create session: `sessionId`, `room_name`, signed access token, share code (+optional PIN), seeded mock flight |
| 2 | `GET /api/voice-token?sessionId&role` | **existing** (v1 §8.1) | Mint VB/LiveKit token into the shared room; `role=joiner` requires verified access |
| 3 | `POST /api/join` | **existing** (v1 §8.3) | Verify signed link token (primary) or shareCode+PIN (fallback) |
| 4 | `POST /api/agent` | **existing** (v1 §8.4) | The brain: intent → mock Sabre → events → Hindi reply (reached via SDK `onAIAgentQuery` relay from the requester client) |
| 5 | `GET /api/session/[id]/state` | **new** | Snapshot for dashboard hydration: flight, `ssr`, presence, current `seq` |
| 6 | `GET /api/session/[id]/events?since=` | **new** | Event-log poll (monotonic `seq`); powers cards, action log, joiner transcript, replay |
| 7 | `POST /api/session/[id]/transcript` | **new** | Requester client forwards final transcript lines; server translates (hi↔en) + appends `transcript` event |
| 8 | `POST /api/demo/disrupt` | **new** (was in v2) | `{kind: "gate_change"|"delay"}` → mutate mock Sabre, **silently drop SSR**, append `flight_event` + `flight_update` |
| 9 | `POST /api/relay` | **new** (was in v2) | Joiner text → append `family_message` event → requester client fires the client action → agent voices it |
| 10 | `GET /api/healthz` | **new** | Cloud Run liveness; returns `{ok, sessions}` |

**Auth model:** `POST /api/session` returns a one-time `requesterKey`; requester calls send it as `x-wb-key`. Joiner calls carry the signed `t` token (HMAC over `sessionId|exp`, verified statelessly by `lib/access.ts`). Endpoints 5, 6 accept either credential; 8, 9 accept `t` (presenter drives from the joiner dashboard); 7 requires `x-wb-key`.

### 4.2 State model (`lib/session-store.ts`)

```ts
type SSRState = "none" | "confirmed" | "dropped" | "reconfirmed";

interface Session {
  sessionId: string; roomName: string; createdAt: number;
  requesterKey: string; shareCode: string; pinHash?: string;
  language: "hi";                       // traveler language (STT/TTS config)
  flight: { carrier: string; number: string; date: string;
            origin: string; dest: string; schedDep: string;
            status: "on_time" | "delayed" | "cancelled";
            gate: string; delayMin: number };
  ssr: SSRState;
  presence: { requester: boolean; joiner: boolean };
  seq: number;                          // monotonic, incremented per event
  events: WBEvent[];                    // append-only, capped at 500
}
```

In-memory `Map<string, Session>` — valid **only** because Cloud Run runs one warm container. The store interface (`get/create/append/mutate`) is the seam for a KV swap if hosting changes.

### 4.3 Event envelope (`lib/events.ts`)

```ts
type WBEvent = { seq: number; ts: number } & (
  | { type: "flight_event"; kind: "gate_change" | "delay"; gate?: string; delayMin?: number }
  | { type: "ssr_update"; value: SSRState }
  | { type: "agent_action"; label: string }                    // "Checked booking ABC123", "Filed WCHR"
  | { type: "facilities"; airport: string; need: string; result: string }
  | { type: "family_message"; text: string }                   // relay payload
  | { type: "flight_update"; kind: string; gate?: string; delayMin?: number } // requester client → app→agent action
  | { type: "presence"; who: "requester" | "joiner"; kind: "joined" | "left" }
  | { type: "transcript"; role: "traveler" | "agent" | "joiner";
      lang: string; text: string; textTranslated?: string }
);
```

Every mutation appends an event; the poll endpoint returns `events.filter(e => e.seq > since)`. `?demo=1` replays a scripted `WBEvent[]` from `lib/demo-script.ts` through the same renderer — one card/transcript code path for live and fallback.

### 4.4 Agent brain (`POST /api/agent` + `lib/`)

- Reached via the **SDK-documented delegation path**: VB agent → `onAIAgentQuery` in the requester client → `POST /api/agent {sessionId, query}` → `{answer}` (Hindi) → spoken. No unverified VB webhooks.
- Intent handling (keyword/few-shot; keep deterministic for the demo): `flight_status`, `flight_rebook`, `wheelchair_request`, `facilities(need)`, `notify_family(text)`, `smalltalk/repeat`.
- Each intent calls `lib/sabre.ts` (mock: deterministic flight; rebook; SSR read/write with `dropped→reconfirmed` transition) or `lib/facilities.ts` (static table: SFO + DEN — pharmacy, water, rest zone, family restroom, medical room, each with terminal/gate anchor), appends `agent_action` / `ssr_update` / `facilities` events, and returns one short Hindi sentence.
- **Guardrail lives here AND in the VB prompt:** medication/symptom/dosing → fixed decline + facilities offer + notify-family offer.
- `lib/translate.ts`: `translate(text, "hi"|"en", dst)` — phrase map for scripted lines first; Anthropic API (claude-haiku) behind the same signature if time allows. Skip when src==dst.

### 4.5 VB agent configuration (`scripts/vb-setup.sh` + `prompts/`)

```bash
pip install vocal-bridge          # CLI
vb auth login                     # $VOCAL_BRIDGE_API_KEY
vb prompt set --file prompts/agent_hi.md
vb config set --model-settings-file config/model_settings.json   # stt.language: "hi", tts: eleven_multilingual_v2 + Hindi-capable voice
vb config set --client-actions-file config/client_actions.json
```

`config/client_actions.json` registers: app→agent `flight_update` ("re-check the booking and tell the traveler the new gate and wheelchair status in one calm sentence") and `family_message` ("relay this verbatim in Hindi, prefixed with the family member's name"); agent→app `show_status` (optional card hint). `prompts/agent_hi.md` encodes: Hindi-only, AI + visibility disclosure in the greeting, one fact per sentence, calm repetition, the medical guardrail, and the two client-action reactions. Re-run `vb-setup.sh` after any prompt/config edit.

### 4.6 Deploy (Cloud Run)

- `Dockerfile`: `node:22-slim`, `next build`, `next start -p 8080`.
- `gcloud run deploy wing-buddy --source . --min-instances 1 --max-instances 1 --allow-unauthenticated --region us-west1` (**max 1 too** — a second instance would split the session Map).
- Env: `VOCAL_BRIDGE_API_KEY`, `VB_AGENT_ID`, `ACCESS_TOKEN_SECRET`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_APP_URL`, `SABRE_MODE=mock` (Secret Manager for keys).
- Local dev: `next dev` is single-process — identical semantics, no ngrok needed (VB never calls us; the client relays).

---

## 5. Repo Structure (delta from current)

```
  app/api/session/route.ts                 # existing
  app/api/session/[sessionId]/state/route.ts      # NEW
  app/api/session/[sessionId]/events/route.ts     # NEW (poll)
  app/api/session/[sessionId]/transcript/route.ts # NEW
  app/api/voice-token/route.ts             # existing
  app/api/join/route.ts                    # existing
  app/api/agent/route.ts                   # existing (brain)
  app/api/demo/disrupt/route.ts            # NEW
  app/api/relay/route.ts                   # NEW
  app/api/healthz/route.ts                 # NEW
  lib/{session-store,events,sabre,facilities,access,translate,speakers,vocalbridge,demo-script}.ts
  components/FacilitiesCard.tsx            # NEW
  prompts/agent_hi.md                      # NEW — VB system prompt
  config/{model_settings.json,client_actions.json}  # NEW — applied via vb CLI
  scripts/vb-setup.sh                      # NEW
  Dockerfile                               # NEW
```

---

## 6. UX Specifications

Unchanged from v1 PLAN.md (landing, one-tap requester UI, join gate, joiner dashboard) plus: three-state wheelchair badge (✓/⚠/✓, animated), FacilitiesCard on both UIs, disclosure sentence in the greeting, and the `d` keybinding on the joiner dashboard → `POST /api/demo/disrupt`.

---

## 7. Build Order (6-hour budget — server items folded in)

### Hour 1: Scaffold + Spine + SPIKES
- Scaffold; design tokens; landing + `/help` skeleton; `lib/access.ts`; `lib/session-store.ts` + `lib/events.ts`; `POST /api/session`; `GET /api/voice-token`; `GET /api/healthz`.
- **Spike A (gating): shared-room 3-way** — two tabs, two tokens, same room, both hear the agent.
- **Spike B (gating): Hindi end-to-end** — one live utterance round-trip with `stt.language: "hi"`.
- Milestone: token endpoint valid; spike verdicts recorded at the top of this file.

### Hour 2: Mock Sabre + Brain + Disrupt + Poll backbone
- `lib/sabre.ts` (incl. drop-on-disrupt), `lib/facilities.ts`, `POST /api/agent` intents + guardrail, `lib/translate.ts` phrase map.
- `GET .../state`, `GET .../events`, `POST .../transcript`, `POST /api/demo/disrupt`, `d` binding.
- Milestone: requester connects, agent speaks Hindi; `curl` disrupt → event log shows `flight_event` + `ssr_update: dropped→reconfirmed` after the agent's re-check.

### Hour 3: Status Cards + Joiner Dashboard + Demo Fallback
- StatusCard (3-state badge), AgentActionLog, FacilitiesCard, joiner dashboard hydration + poll loop, `lib/demo-script.ts` through the same renderer.
- Milestone: joiner sees live cards + bilingual transcript; badge flip animates.

### Hour 4: 3-Way (if Spike A passed) + Relay + Speakers
- Shared-room Join Call, `lib/speakers.ts`, observe→speak flow.
- **`POST /api/relay` + requester-client bridge ships regardless.**
- Milestone: family can speak to Mom by at least one live path.

### Hour 5: Share + Auth + Accessibility + Deploy
- ShareSheet, PinToggle, JoinGate, TapToTalk, ARIA/reduced-motion pass.
- **Cloud Run deploy + smoke test the full flow on the public URL** (share links must work on a real phone).
- Milestone: end-to-end on production URL: help → share → observe → disrupt → (join|relay).

### Hour 6: Demo Run-Through + Buffer
- Rehearse 5× against §8; verify `?demo=1`; record a clean backup run.

---

## 8. Demo Script (2 minutes)

1. Landing → requester taps → agent greets in Hindi **with the AI/visibility disclosure**.
2. Mom (scripted Hindi): flight changed, needs a wheelchair → brain → mock-Sabre → cards fill; wheelchair ✓; "🔄 Calling airline… ♿ confirmed" sub-states narrate the airline beat.
3. Share → WhatsApp link → joiner dashboard observing, bilingual transcript live.
4. **Climax — presenter presses `d`:** gate changes, SSR silently drops, agent tells Mom unprompted: *"आपका गेट बदल गया है — 14A। आपकी व्हीलचेयर फिर से confirmed है।"* Badge ✓→⚠→✓ on both UIs. Judge line: "Assistance requests get dropped when flights change. WingBuddy is the agent that notices."
5. Mom: "मुझे दवाई के लिए पानी चाहिए" → facilities card + **no medical advice** + offer to tell family. *(First beat to cut if over time.)*
6. Human-in-loop: "Speak now" pulse → Join Call (or relay) → English↔Hindi bridge → Mom confirms.
7. Wrap: "Three-way conversation, live translation, an agent that catches what airlines drop — Vocal Bridge + Sabre."

Fallback at any point: `?demo=1`.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| **In-memory store on multi-instance runtime** | Cloud Run `min=max=1`; store behind a swappable interface; never Vercel serverless with in-memory |
| Shared-room join fails | Spike A Hour 1; relay ships regardless; `?demo=1` last resort |
| Hindi STT quality | Spike B Hour 1; English + code-switch fallback |
| Poll latency feels laggy on joiner | 1.5s interval is invisible for cards; transcripts also arrive on requester instantly via data channel |
| Two VB agents in one room | Not attempted by default — narrated sub-state cards |
| Mic permission fails live | Pre-grant on landing; tap-to-talk |
| Venue Wi-Fi drops | `?demo=1` + recorded backup run |
| Speaker attribution fails | SDK transcript `role` fallback |
| 3-way audio echo | Mute non-speaking participants; rehearse |

---

## 10. Cut List (in order, if time-pressed)

1. Manual `/join` code+PIN fallback
2. PIN toggle
3. Facilities demo beat (keep guardrail in prompt + pitch)
4. Real API translation (phrase map sufficient)
5. Shared-room Join Call (relay carries the family-speaks beat)
6. 4th-participant mock airline agent (already default-off)

Never cut: disruption climax (`d` → badge flip), disclosure greeting, `?demo=1`, relay mode, the event-log poll backbone.
