# WingBuddy — Engineering Notes (AGENTS.md)

Hackathon project: an AI voice agent bridging a Hindi-speaking distressed
traveler, their family, and the airline. **Next.js (App Router) + TypeScript +
Tailwind v4** with `@vocalbridgeai/react`. Sabre fully mocked. Designed for
**Apple HIG** (deference, clarity, depth, restraint).

Source of truth for product/architecture decisions: **`PLAN-v2.md`** + **`CLAUDE.md`**.
The older `PLAN.md` is historical only — do not implement from it.

## Repo layout (monorepo)

The Next.js app (client pages **and** its API route handlers — the "server
code" — all in one deploy) lives under **`client/`**:

```
client/            # the whole Next.js app
  app/             # pages + app/api/* route handlers
  components/
  lib/             # events, session-store, access, vocalbridge, design
  public/
  package.json, next.config.ts, vercel.json, Dockerfile, ...
```

CLAUDE.md requires this to be **one Next.js app**: client + API handlers stay
together in `client/`. Sibling dirs (e.g. `server/`, `scripts/`, `infra/`) may
be added at the repo root later, but must not split the app's in-memory session
store or same-origin `/api/agent` relay across hosts.

## Commands

All commands run from inside `client/`:

```bash
cd client
npm run dev       # local dev (single process — same semantics as prod)
npm run build     # production build (also type-checks)
npm run start     # serve the production build (port from PORT env, default 3000)
npm run lint      # eslint
```

Node 22+ (Next 16). Use `npm`, not `pnpm`/`yarn` (lockfile is package-lock.json).

## Environment

From inside `client/`, copy `client/.env.local.example` → `client/.env.local`.
Required for live voice: `VOCAL_BRIDGE_API_KEY`, `VB_AGENT_ID`,
`ACCESS_TOKEN_SECRET`. Never commit `.env.local` or any secret (CLAUDE.md repo
rules). `.env.local.example` is tracked; `.env*` is git-ignored.

## Architecture rules (non-negotiable — see CLAUDE.md)

1. **Audio never transits our server.** Browser → VB over WebRTC. Server only
   mints tokens, runs the brain, keeps session state, serves the event log.
2. **Session state is an in-memory `Map` (`lib/session-store.ts`)**, safe
   *only* because exactly one container runs. The `SessionStore` interface is
   the swap seam for KV.
3. **Two real-time paths.** VB data channel (transcripts, agent actions,
   presence) + server **append-only event log polled every 1.5s**
   (`GET /api/session/[id]/events?since=seq`). No custom WebSocket.
4. **Server never calls the VB agent directly.** Brain via SDK `onAIAgentQuery`
   in the requester client → `POST /api/agent`. Server-initiated speech =
   append `family_message`/`flight_update` event → requester client converts to
   an app→agent client action.
5. **Requester client is the transcript source** → `POST /api/session/[id]/transcript`.

## API surface (complete — do not add endpoints without updating PLAN-v2 §4.1)

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/session` | none | Create session: id, room_name, signed `t`, requesterKey, shareCode, seeded flight |
| `GET /api/voice-token?sessionId&role` | requesterKey / verified joiner | VB token into shared room (placeholder in Hour 1) |
| `POST /api/join` | signed `t` or shareCode+PIN | Verify joiner access |
| `POST /api/agent` | requesterKey | Brain: intent → mock Sabre → events → Hindi reply |
| `GET /api/session/[id]/state` | either credential | Snapshot for dashboard hydration |
| `GET /api/session/[id]/events?since=` | either credential | Event-log poll (monotonic seq) |
| `POST /api/session/[id]/transcript` | requesterKey | Log + translate a final transcript line |
| `POST /api/demo/disrupt` | `t` | `{kind}` → mutate flight, drop SSR, append events |
| `POST /api/relay` | `t` | Joiner text → `family_message` event → agent voices it |
| `GET /api/healthz` | none | Cloud Run liveness |

Hour 1 implemented: `session`, `voice-token`, `healthz`. Remaining routes are
Hour 2–4 work.

## Design system

- Tokens live in **`lib/design/tokens.ts`** (TS source of truth) and are mirrored
  into **`app/globals.css` `@theme`** (Tailwind v4 — no `tailwind.config.ts`).
  Edit both together.
- Fonts: Apple system stack (`lib/design/fonts.ts`). High contrast, 8pt spacing
  grid, `prefers-reduced-motion` respected (globals.css disables non-essential
  animation).
- Components in `components/` are prop-only stubs for Hour 1; real wiring Hour 2+.

## Deployment — Vercel (only)

The app is deployed to **Vercel** (no Cloud Run). Run all deploy commands from
inside `client/`:

```bash
cd client
vercel deploy
```

`client/vercel.json` is minimal (framework auto-detect + build commands). The
same `package.json` scripts power the build.

**Constraint — in-memory session store is unsafe on Vercel serverless
multi-instance.** Either:
- deploy with **`max-instances 1`** (Vercel Pro/Enterprise function concurrency
  limit), or
- set `SESSION_STORE=kv` and implement the KV-backed `SessionStore`
  (`lib/session-store.ts` getStore seam) against Upstash/Redis/Vercel KV before
  scaling past one instance.

The `Dockerfile` at `client/Dockerfile` is kept for local/container runs but is
not the deploy target.

## Git

- Commit **and push** after each passing PLAN-v2 milestone: `feat: <milestone> passing`.
- The remote is the demo-day backup. **Never force-push** (a teammate may be
  committing concurrently) — use `git pull --rebase` before pushing.
- Public repo: never commit API keys, `ACCESS_TOKEN_SECRET`, or real PNRs.
