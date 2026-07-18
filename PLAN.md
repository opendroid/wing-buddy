# WingBuddy — Hackathon Plan

**One-line pitch:** An AI voice agent that bridges a Hindi-speaking distressed traveler, a remote English-speaking family member, and the airline — translating, advocating, and keeping everyone in the loop in real time.

**Stack:** Next.js (App Router) + TypeScript + Tailwind, `@vocalbridgeai/react`, one Vercel deploy. Sabre mocked. Apple-standard design system. Distress-first, low-friction access.

---

## 1. Locked Decisions

| Decision | Choice |
|----------|--------|
| App structure | One app, one Vercel deploy. Role by route + token `role` param → same `room_name` → 3-way. |
| Hero demo story | Trialogue + live translation + human-in-loop interrupt. Sabre mocked entirely. |
| Airline agent | Mock second VB agent (deep-voice IVR), not a real phone call. |
| Demo resilience | `?demo=1` scripted fallback for transcript + status. |
| Mic fallback | Tap-to-talk if auto-grant fails. |
| Access model | Signed link via share sheet (WhatsApp/SMS). PIN opt-in/off. Manual `/join` fallback kept. |
| Speaker attribution | Read LiveKit participant identity → tag speakers. |
| Terminology | Role-neutral: "Request help" / "Join a call" — no family-role labels. |
| UI status | Live sub-state cards on both UIs during demo — the visible script. |
| Styling | Tailwind + shared design tokens; Apple HIG (deference, clarity, depth, restraint). |
| Sabre | Mock-first behind clean interface; never live for demo. |
| Joiner voice entry | Observe first → explicit "Join Call" tap enters 3-way. |

---

## 2. Routes

```
/                       → landing: Request help | Join a call
/help                   → requester one-tap voice UI + live status cards + Share + (translation toggle)
/room/[sessionId]?t=…   → joiner dashboard (signed-link access): bilingual transcript + cards + Join Call
/join                   → manual code + PIN fallback
```

---

## 3. Architecture

### 3.1 Shared Room
- `/api/voice-token?sessionId&role` issues a LiveKit token for a **shared `room_name`**.
- Requester (`role=requester`), joiner (`role=joiner`), the VocalBridge agent, and the mock airline agent all join the same room.
- Joiner token is only issued after `/api/join` verifies a signed access token (or code+PIN fallback).

### 3.2 Real-Time Sync
- `agentAction`/`sendAction` data channel broadcasts structured events to both UIs.
- No custom WebSocket needed. Events include: flight status, SSR/wheelchair status, agent action log, "someone joined" banner, sub-state progress.

### 3.3 Brain (/api/agent)
- `onQuery` receives Mom's Hindi speech.
- Translates intent → mock-Sabre lookup (flight rebook, WCHR wheelchair SSR).
- Returns English script for the agent to speak back in Hindi to Mom.
- Fires `sendAction` with UI update events.
- Mock airline agent (second VB agent) participates in the room as a 4th participant when active.

### 3.4 Access (Distress-First)
- **Primary:** Signed link (`/room/[sessionId]?t=<hmac-token>`) shared via native OS share sheet (WhatsApp/SMS). Possession of link = access. Zoom/Meet model.
- **Optional PIN:** Requester toggles on if desired; default OFF. Never blocks during distress.
- **Fallback:** Manual `/join` code + PIN entry.

### 3.5 Mock Airline Agent
- Second VocalBridge agent with deeper voice, IVR-style prompt ("Welcome to American Airlines rebooking...").
- Mocks hold music, confirmation numbers, wheelchair filing confirmation.
- Participates as a 4th speaker in the shared room.

### 3.6 Demo Fallback Mode
- `?demo=1` param on `/room/[sessionId]?t=...&demo=1`.
- Pre-populated transcript entries + synthetic status card progress bar.
- Triggered manually if live audio fails mid-demo.

---

## 4. Repo Structure

```
wingbuddy/
  PLAN.md                          # this file
  package.json
  next.config.ts
  tailwind.config.ts
  tsconfig.json
  .env.local                       # VOCAL_BRIDGE_API_KEY, MOCK_*, etc.
  app/
    page.tsx                       # landing: two cards — Request help | Join
    help/
      page.tsx                     # requester one-tap UI + live status cards + Share
    room/
      [sessionId]/
        page.tsx                   # joiner dashboard (signed-link access)
    join/
      page.tsx                     # manual code + PIN fallback
    api/
      voice-token/
        route.ts                   # token proxy → shared room_name (role-gated)
      agent/
        route.ts                   # AI brain: Hindi↔English + mock Sabre + sendAction
      session/
        route.ts                   # create session + signed access token + flight ctx
      join/
        route.ts                   # validate signed link (primary) / code+PIN (fallback)
  lib/
    vocalbridge.ts                 # shared VocalBridge client config
    sabre.ts                       # mock Sabre: flight lookup, rebook, WCHR SSR
    access.ts                      # HMAC sign/verify short-TTL access tokens
    speakers.ts                    # LiveKit participant identity → speaker name mapping
    translate.ts                   # Hindi↔English translation bridge (mock or API)
    session-store.ts               # in-memory Map: sessionId → { room_name, shareCode, pin, flight, participants }
    demo-script.ts                 # ?demo=1 scripted transcript + events for fallback
    design/
      tokens.ts                    # type scale, spacing (8pt), motion curves, colors
      fonts.ts                     # font stack, sizes, line-heights
  components/
    BigCallButton.tsx              # requester's huge pulsing "Tap to Get Help"
    Transcript.tsx                 # shared, speaker-attributed, bilingual, auto-scroll
    StatusCard.tsx                 # live sub-state card (flight, wheelchair, agent progress)
    AgentActionLog.tsx             # scrollable log of agent actions
    ShareSheet.tsx                 # native share button + fallback copy-link
    JoinedBanner.tsx               # "Someone joined the call" gentle banner
    JoinCallButton.tsx             # joiner's "Join Call" / "Leave Call" CTA
    TapToTalk.tsx                  # press-and-hold fallback mic
    PinToggle.tsx                  # optional PIN toggle (off by default)
    JoinGate.tsx                   # code+PIN entry form
    DemoOverride.tsx               # ?demo=1 scripted UI state manager
```

---

## 5. UX Specifications

### 5.1 Landing Page (`/`)
- Two large calm cards centered on a neutral background.
- Left card: "Request help" — icon + subtitle. Routes to `/help`.
- Right card: "Join a call" — icon + subtitle. Routes to `/join`.
- Apple HIG: deference to content, generous whitespace, spring-ease hover/tap.
- System font stack (`-apple-system, ui-sans-serif`), 16px base, high contrast.

### 5.2 Requester One-Tap UI (`/help`)
- **State 1 — Idle:** Single huge pulsing button, full-width, min 64pt tap target. "Tap to Get Help." High contrast, calm pulse animation.
- **State 2 — Connecting:** Spinner + "Connecting you to help…"
- **State 3 — Connected:** Status pill ("Agent speaking" / "Listening") + live Hindi transcript + status sub-state cards.
- **Transcript:** 20–24px, auto-scroll, color-coded by speaker, lines fade from vivid to dimmed after 10s. ARIA live region, VoiceOver labels.
- **Status sub-state cards:** "🔄 Calling airline (0:14 hold)", "✈️ Found seat on UA 2348 4:15pm", "♿ Wheelchair confirmed Gate 3". Pulsing dots, never alarming.
- **Share:** Share button → native OS share sheet → WhatsApp/SMS a signed link. Falls back to copy-link.
- **PIN toggle:** Small toggle off by default. "Add a PIN for extra privacy" — opt-in only.
- **Joined banner:** "🟢 Someone joined the call" — reassurance, not alarm.
- **Controls:** Big red "End Call" + mic mute toggle. Nothing else.
- **Tap-to-talk fallback:** If mic auto-grant fails, show a large press-and-hold button.
- Accessibility: semantic HTML, ARIA live, respects `prefers-reduced-motion`, no color-only cues.

### 5.3 Join Gate (`/join`)
- Centered floating card on soft neutral background.
- Title: "Join a call" — subtitle: "Enter the code shared with you."
- Code input (6-char, auto-uppercased, auto-grouped) + PIN input (4 digits).
- Inline validation, Enter-to-submit, soft shake on failure.
- Autofocus, big tap targets.

### 5.4 Joiner Dashboard (`/room/[sessionId]?t=…`)
- **Layout (desktop split / mobile stacked):**
  - Left: **Bilingual transcript** (English/Hindi toggle) — same `Transcript.tsx` component, dense variant.
  - Right column of **status cards:**
    - Requester connection status (green/red dot).
    - Flight status: old time → new time, gate change.
    - Wheelchair/SSR request status.
    - Agent action log (`AgentActionLog.tsx`).
- **"Join Call" CTA:** Gray/secondary (observing) → cyan/bold "Speak now" pulse when agent requests human decision. Tap enters 3-way.
- **Real-time** via `agentAction` data channel events (no polling).
- **Demo override:** `?demo=1` → pre-populated transcript + synthetic status card progress bar.

---

## 6. Build Order (6-Hour Budget)

### Hour 1: Scaffold + Spine + Visible Progress
- `npx create-next-app@latest wingbuddy --ts --tailwind --app`
- Install `@vocalbridgeai/sdk @vocalbridgeai/react`.
- Create `lib/design/tokens.ts` (type scale, 8pt spacing, motion curves, colors).
- Create `app/page.tsx` — landing page with two cards.
- Create `app/help/page.tsx` — `BigCallButton.tsx` placeholder + `Transcript.tsx` skeleton.
- Create `app/api/voice-token/route.ts` — token proxy endpoint (shared `room_name` by sessionId).
- Create `lib/vocalbridge.ts` — shared VocalBridge config.
- Create `lib/session-store.ts` — in-memory Map.
- Create `lib/access.ts` — HMAC sign/verify for short-TTL tokens.
- **Milestone:** App runs locally, landing → help, token endpoint returns a valid VocalBridge token.

### Hour 2: Mock Sabre + Mock Airline Agent + Brain
- Create `lib/sabre.ts` — mock flight lookup (deterministic: "UA 2348 4:15pm, gate 14A"), mock rebook, mock WCHR SSR ("confirmed, wheelchair at Gate 3").
- Create `app/api/agent/route.ts` — `onQuery` handler: Hindi STT → intent parse → mock-Sabre → English response → `sendAction` fires UI events → Hindi TTS back.
- Create `lib/translate.ts` — Hindi↔English bridge (mock phrase map or real API if available).
- Configure mock airline agent (second VB agent profile) with deep-voice IVR prompt.
- Wire agent brain into `app/api/voice-token` so agent joins the room on requester connect.
- **Milestone:** Requester connects, agent speaks Hindi, mock-Sabre lookup fires, `sendAction` events broadcast.

### Hour 3: Status Cards + Joiner Dashboard + Demo Fallback
- Create `components/StatusCard.tsx` — live sub-state display with pulse animation.
- Create `components/AgentActionLog.tsx` — scrollable action history.
- Create `app/room/[sessionId]/page.tsx` — joiner dashboard with split layout.
- Wire `agentAction` events to dashboard status cards + transcript.
- Create `lib/demo-script.ts` — `?demo=1` scripted transcript entries + status progression.
- Create `components/DemoOverride.tsx` — manages scripted fallback state.
- **Milestone:** Joiner can open signed link, sees live status cards + transcript updating in real time.

### Hour 4: 3-Way Call + Speaker Attribution + Join Call
- Implement shared-room mechanism: force same `room_name` in token endpoint.
- Create `lib/speakers.ts` — read LiveKit participant identity → map to speaker name (Requester / Joiner / Agent / Airline Agent).
- Create `components/JoinCallButton.tsx` — observe → "Join Call" (cyan pulse) → 3-way → "Leave Call".
- Wire joiner's `voice-token` issuance after `/api/join` verification.
- Speaker-attributed transcript: color + label per speaker in `Transcript.tsx`.
- **Milestone:** 3-way call works — requester + joiner + agent in one room, transcript correctly attributed.

### Hour 5: Share + Auth + Accessibility + Polish
- Create `components/ShareSheet.tsx` — native `navigator.share` + fallback copy-link.
- Wire share button on `/help` to send signed link via WhatsApp/SMS.
- Create `components/PinToggle.tsx` — opt-in PIN toggle on `/help`.
- Create `components/JoinGate.tsx` — code+PIN fallback form on `/join`.
- Create `components/TapToTalk.tsx` — press-and-hold fallback mic.
- Accessibility pass: ARIA live regions, VoiceOver labels, reduced-motion, high contrast, semantic HTML, keyboard navigation.
- **Milestone:** Full flow works end-to-end, share → join → observe → join call → trialogue.

### Hour 6: Demo Run-Through + Buffer
- Run through demo script 3×.
- Test `?demo=1` fallback mode works cleanly.
- Verify mic pre-grant + tap-to-talk fallback.
- Polish visual details: spring motion, font sizes, color restraint.
- Buffer for unexpected fixes.
- **Milestone:** Demo-ready, resilient, polished.

---

## 7. Demo Script (Judges)

### Setup (pre-demo)
- Two browsers open: one simulating requester (phone viewport), one simulating joiner (desktop viewport).
- `?demo=1` param ready if live audio fails.

### Narrative (2 minutes)
1. **Landing:** "This is WingBuddy. A distressed traveler at the airport needs help. Watch."
2. **Requester taps "Request help"** → connects → agent greets in Hindi: *"मैं यहाँ आपकी मदद के लिए हूँ। बताइए क्या हुआ?"*
3. **Mom responds in Hindi** (scripted): *"मेरी फ्लाइट का टाइम बदल गया है और मुझे व्हीलचेयर चाहिए..."*
4. **Agent translates intent → mock-Sabre → finds new flight + WCHR.** Status cards update live on both UIs.
5. **Agent says:** *"मैंने आपकी फ्लाइट बदल दी है — UA 2348, 4:15pm, Gate 14A. व्हीलचेयर भी confirmed है।"*
6. **Meanwhile, joiner's dashboard shows** the same transcript + status cards updating in real time.
7. **"Share" button → sends link via WhatsApp** → joiner opens it → dashboard, observes.
8. **Agent detects human decision needed → joiner sees "Speak now" pulse → taps Join Call.**
9. **Triagent:** Joiner (English) asks: "Can you confirm the wheelchair is available at Gate 14A?" → Agent translates to Hindi for Mom → Mom confirms → Agent confirms to joiner.
10. **"Someone joined" banner** reassured Mom throughout.
11. **Wrap:** "Three-way conversation, live translation, real-time status — all powered by Vocal Bridge + Sabre."

### Fallback
If live audio fails at any point → switch to `?demo=1` mode → pre-populated transcript + synthetic status cards continue the story seamlessly.

---

## 8. Key Technical Details

### 8.1 Token Endpoint (`/api/voice-token`)
```
GET /api/voice-token?sessionId=xxx&role=requester
GET /api/voice-token?sessionId=xxx&role=joiner

- Validates role is 'requester' or 'joiner'.
- For joiner: verifies signed access token (or code+PIN fallback) first.
- Both use the SAME room_name (from session store).
- Returns LiveKit token with participant identity set to role.
```

### 8.2 Session Creation (`/api/session`)
```
POST /api/session
- Creates sessionId (uuid).
- Generates room_name (e.g., "wingbuddy-{uuid-short}").
- Generates signed access token (HMAC, 15min TTL).
- Generates optional share code + PIN.
- Stores in session-store.ts (in-memory Map).
- Returns { sessionId, room_name, accessToken, shareCode, flightContext }.
```

### 8.3 Access Token Verification (`/api/join`)
```
POST /api/join
- Primary: validates signed access token (HMAC verify, TTL check).
- Fallback: validates shareCode + PIN.
- Returns { sessionId, verified: true }.
```

### 8.4 Agent Brain (`/api/agent`)
```
POST /api/agent
- Receives onQuery from VocalBridge.
- Intent: flight_rebook → mock Sabre lookup → { newFlight, gate, time }.
- Intent: wheelchair_request → mock Sabre WCHR → { status: confirmed, location }.
- Fires sendAction('flight_update', { ... }) to UI.
- Fires sendAction('ssr_update', { ... }) to UI.
- Returns Hindi response text.
```

### 8.5 Speaker Attribution (`lib/speakers.ts`)
```
- Reads VocalBridge room.participants (advanced LiveKit access).
- Maps participant identity to role label:
  'requester' → "Traveler" (Hindi color)
  'joiner'    → "Joiner" (English color)
  'agent'     → "Agent" (accent color)
  'airline'   → "Airline Agent" (gray color)
- Transcript component renders with label + color.
```

### 8.6 Demo Fallback (`lib/demo-script.ts`)
```
- Array of { timestamp, speaker, text } entries simulating the full narrative.
- Array of { timestamp, action, payload } events for status cards.
- Activated by ?demo=1 param on joiner dashboard.
- Replay timer advances events; no audio needed.
```

---

## 9. Dependencies

```json
{
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "@vocalbridgeai/sdk": "latest",
    "@vocalbridgeai/react": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "@types/react": "latest",
    "@types/node": "latest",
    "tailwindcss": "latest",
    "postcss": "latest",
    "autoprefixer": "latest"
  }
}
```

---

## 10. Environment Variables (`.env.local`)

```
VOCAL_BRIDGE_API_KEY=vb_xxx
NEXT_PUBLIC_APP_URL=https://wingbuddy.vercel.app
ACCESS_TOKEN_SECRET=hmac-secret-for-signed-links
```

---

## 11. Design Tokens (`lib/design/tokens.ts`)

```typescript
export const design = {
  spacing: { base: 8, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  motion: {
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    duration: { fast: 150, normal: 250, slow: 400 },
  },
  colors: {
    bg: '#FAFAFA',
    card: '#FFFFFF',
    text: '#1D1D1F',
    textMuted: '#86868B',
    accent: '#007AFF', // system blue
    success: '#34C759', // system green
    warning: '#FF9500', // system orange
    danger: '#FF3B30', // system red
    speaker: { requester: '#007AFF', joiner: '#34C759', agent: '#FF9500', airline: '#86868B' },
  },
  type: {
    xs: { fontSize: 12, lineHeight: 16 },
    sm: { fontSize: 14, lineHeight: 20 },
    base: { fontSize: 16, lineHeight: 24 },
    lg: { fontSize: 20, lineHeight: 28 },
    xl: { fontSize: 24, lineHeight: 32 },
    xxl: { fontSize: 32, lineHeight: 40 },
    hero: { fontSize: 48, lineHeight: 56 },
  },
};
```

---

## 12. Cut List (If Time-Pressed)

Cut these last if the build runs long:

- [ ] Manual `/join` code+PIN fallback (signed link suffices for demo).
- [ ] Real Sabre API swap (mock is fine).
- [ ] Real `vb call` outbound path (mock airline agent is better).
- [ ] Optional PIN toggle (default off, can skip entirely).
- [ ] Full Hindi↔English translation (mock phrase map sufficient).

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| WebRTC mic permission fails live | Pre-grant on landing; tap-to-talk fallback |
| Venue Wi-Fi drops | `?demo=1` scripted fallback |
| Sabre live API fails | Fully mocked; never called in demo |
| `vb call` outbound fails | Mock airline agent as 2nd VB participant |
| Speaker attribution fails | Fallback to `role` from SDK transcript (`user`/`agent`) |
| LiveKit room drops | Auto-reconnect (SDK default 3 attempts); fallback to demo mode |
| 3-way audio echo | Mute non-speaking participants; test in rehearsal |
