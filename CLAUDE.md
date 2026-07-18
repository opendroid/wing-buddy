# WingBuddy — Project Context (CLAUDE.md)

WingBuddy: an AI voice agent bridging a Hindi-speaking distressed traveler at an airport, a remote English-speaking family member, and the airline — live translation, advocacy, real-time status. Hackathon project (DeepLearning.AI Voice AI Hackathon, Sabre + Vocal Bridge).

**Stack: one Next.js (App Router) + TypeScript + Tailwind app** with `@vocalbridgeai/react`. Sabre fully mocked behind `lib/sabre.ts`. Deployed to **Cloud Run with `--min-instances 1 --max-instances 1`**. This file supersedes the earlier FastAPI/Python design entirely — if you see FastAPI/MCP-server remnants anywhere, they are dead code from a previous architecture; flag and remove them.

Build order, spikes, acceptance milestones, and the demo script live in **PLAN.md** — work it top to bottom. This file holds the rules that apply to every session.

## Non-negotiable architecture rules

1. **Audio never transits our server.** The requester's browser connects mic→agent directly to Vocal Bridge over WebRTC. Our route handlers only mint tokens, run the brain, keep session state, and serve the event log.
2. **Session state is an in-memory Map (`lib/session-store.ts`) and is only valid because exactly one container runs.** Cloud Run `min=max=1`. Never deploy this to Vercel serverless or scale past one instance without swapping the store to KV — the store interface is the seam.
3. **Real-time sync is two paths, on purpose.** VB's data channel carries what VB natively provides (transcripts, agent client actions, presence). Everything else — server-initiated events (disrupt, relay), status cards, action log, late-joiner replay — flows through the **append-only event log + 1.5s client poll** (`GET /api/session/[id]/events?since=seq`). No custom WebSocket. Do not invent a third path.
4. **The server never talks to the VB agent directly.** Two documented mechanisms only: (a) the brain is reached via the SDK's `onAIAgentQuery` in the requester client → `POST /api/agent`; (b) server-initiated agent speech works by appending a `family_message`/`flight_update` event, which the requester client picks up on poll and converts into an **app→agent client action** on the data channel. If a task seems to need a server→VB webhook, it doesn't — reroute through (b).
5. **The requester client is the transcript source.** It forwards each final line to `POST /api/session/[id]/transcript`; the server translates (hi↔en, `lib/translate.ts`) and logs it. The joiner reads transcripts from the event log.

## API surface (complete — do not add endpoints without updating PLAN.md §4.1)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/session` | none (creates) | New session: sessionId, room_name, signed access token, shareCode, requesterKey, seeded mock flight |
| `GET /api/voice-token?sessionId&role` | requesterKey / verified joiner | VB/LiveKit token into the shared `room_name` |
| `POST /api/join` | signed `t` token or shareCode+PIN | Verify joiner access |
| `POST /api/agent` | requesterKey | The brain: intent → mock Sabre / facilities → events → one Hindi sentence back |
| `GET /api/session/[id]/state` | either credential | Snapshot: flight, ssr, presence, seq |
| `GET /api/session/[id]/events?since=` | either credential | Event-log poll (monotonic seq) |
| `POST /api/session/[id]/transcript` | requesterKey | Log + translate a final transcript line |
| `POST /api/demo/disrupt` | `t` token | `{kind}` → mutate flight, silently drop SSR, append events (`d` key on joiner dashboard) |
| `POST /api/relay` | `t` token | Joiner text → `family_message` event → agent voices it to Mom |
| `GET /api/healthz` | none | Cloud Run liveness |

Auth helpers in `lib/access.ts`: stateless HMAC for `t` (sessionId|exp, `ACCESS_TOKEN_SECRET`); `requesterKey` returned once by `POST /api/session`, sent as `x-wb-key`.

## State + events (canonical types — `lib/session-store.ts`, `lib/events.ts`)

- `Session`: sessionId, roomName, requesterKey, shareCode, pinHash?, language:"hi", flight {carrier, number, date, origin, dest, schedDep, status, gate, delayMin}, `ssr: "none"|"confirmed"|"dropped"|"reconfirmed"`, presence, seq, events[] (capped 500).
- `WBEvent` (all carry seq, ts): `flight_event` | `ssr_update` | `agent_action` | `facilities` | `family_message` | `flight_update` | `presence` | `transcript {role, lang, text, textTranslated?}`.
- `?demo=1` replays a scripted `WBEvent[]` (`lib/demo-script.ts`) through the SAME renderers as live events — never build a separate demo UI path.

## Agent behavior (`prompts/agent_hi.md` + brain guardrails — both places)

- Greeting includes the disclosure, in Hindi: AI assistant + "your family can see our conversation."
- Hindi only; one fact per sentence; short sentences; confirm back; repeat calmly on request; never impatient; end reassurances with "you're doing fine."
- On `flight_update` client action: re-check booking → if SSR dropped, re-add → one calm sentence with new gate + wheelchair status → `agent_action` + `ssr_update` events.
- On `family_message` client action: relay verbatim in Hindi, prefixed with the family member's name.
- **Medical guardrail (enforced in the prompt AND in `/api/agent`):** never advise on medication, symptoms, or dosing. Logistics only — facilities lookup (`lib/facilities.ts`) + offer to notify family.
- After editing `prompts/` or `config/`, re-run `scripts/vb-setup.sh` (vb CLI applies prompt, model settings with `stt.language: "hi"` + multilingual TTS, and the client-actions registration).

## Repository rules

Remote: https://github.com/opendroid/wing-buddy (public — treat every commit as visible).

- `.gitignore` covers: `.env*` (except `.env.example`), `node_modules/`, `.next/`, `data/`.
- Never commit: API keys, `~/.vocal-bridge/config.json` contents, `ACCESS_TOKEN_SECRET`, real PNRs. `.env.example` carries names only.
- Commit **and push** after each passing PLAN.md milestone, message `feat: <milestone> passing`. The remote is the dead-laptop backup on demo day.
- Record Spike A / Spike B verdicts at the top of PLAN.md the moment they run — Hour 4 and the demo script branch on them.
