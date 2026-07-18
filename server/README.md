# WingBuddy — Server

Backend for WingBuddy (AI voice agent bridging a Hindi-speaking traveler, a
remote family member, and the airline). **API only — no UI**; the client app
lives in `../client`. Next.js (App Router) route handlers + `lib/` modules.

Real integrations: **Sabre** (flight data via InstaFlights), **Vocal Bridge**
(hosted Hindi agent + token mint), **Anthropic** (hi↔en translation).

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in real values (see the table below / .env.example)
npm run dev                  # http://localhost:8080  (or: npm run build && npm start)
npm test                     # 56 hermetic tests (Vitest + MSW), no live services
npm run typecheck            # tsc --noEmit
bash scripts/smoke.sh        # end-to-end curl harness against a running server
```

Environment variables are documented (names only) in `.env.example`. Real
values go in `.env.local` (gitignored) — never in `.env.example`, which is
committed to a public repo.

## Endpoints (10)

`POST /api/session` · `GET /api/voice-token` · `POST /api/join` ·
`POST /api/agent` (the brain) · `GET /api/session/[id]/state` ·
`GET /api/session/[id]/events?since=` · `POST /api/session/[id]/transcript` ·
`POST /api/demo/disrupt` · `POST /api/relay` · `GET /api/healthz`.

## ⚠️ Session store caveat (read before deploying to Vercel)

`lib/session-store.ts` is a **dual backend** behind one async interface:

- **Upstash Redis** — when `UPSTASH_REDIS_REST_URL` **and** `UPSTASH_REDIS_REST_TOKEN`
  are set. Durable; safe across instances. Use this for anything real.
- **In-memory `Map`** — the fallback when those are unset.

**The in-memory fallback does NOT work reliably on Vercel serverless.** Vercel
functions are stateless and don't share memory between invocations, and there
is no `min=max=1` single-instance knob. A session created on one instance is
invisible to the next — so the requester's poll loop, the joiner's `/state`,
and `/api/agent` (which all fire concurrently) can hit a different instance and
get **"session not found"** mid-demo.

**For this hackathon we're accepting that risk:** the demo is a single ~3-minute
run, so one warm instance will usually serve the whole session — but it is not
guaranteed (concurrency or a cold start can still split it).

If it misbehaves during rehearsal, three fixes in increasing durability:

1. **Set the two `UPSTASH_*` vars** (create a free Upstash Redis DB) — the
   durable fix; the seam is already there, no code change.
2. **`?demo=1` scripted mode** — replays the full arc with no server state at all.
3. **Run on a single always-on instance** (Cloud Run `min=max=1`, Railway,
   Render) instead of Vercel serverless — where in-memory genuinely works.

## Deploy (Vercel, from GitHub)

- Set the Vercel project **Root Directory to `server/`**.
- Add the env vars from `.env.example` (fill real values). Leaving `UPSTASH_*`
  blank selects the in-memory store — see the caveat above.
- Deploy from `main`, then validate: `BASE_URL=https://…yourserver bash scripts/smoke.sh`.
