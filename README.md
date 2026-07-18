# wing-buddy

Repo for the WingBuddy hackathon app — an AI voice agent bridging a
Hindi-speaking distressed traveler, their family, and the airline
(VocalBridge + Sabre, Next.js + TypeScript + Tailwind).

## Structure

The Next.js app (client pages **and** API route handlers — the "server
code" — in one deploy) lives under **`client/`**. See **`client/AGENTS.md`**,
**`PLAN-v2.md`**, and **`CLAUDE.md`** for architecture, commands, and the
deployment guide.

```bash
cd client
npm install
npm run dev      # http://localhost:3000
```

Deployed to Vercel from inside `client/`.
