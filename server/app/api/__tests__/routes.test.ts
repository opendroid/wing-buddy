import { describe, it, expect, beforeEach } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";

import * as healthz from "@/app/api/healthz/route";
import * as session from "@/app/api/session/route";
import * as voiceToken from "@/app/api/voice-token/route";

import { createSession, __resetStore, type Flight } from "@/lib/session-store";
import { signAccessToken } from "@/lib/access";

const FLIGHT: Flight = {
  carrier: "UA",
  number: "2348",
  date: "2026-07-18",
  origin: "SFO",
  dest: "DEN",
  schedDep: "2026-07-18T16:15:00-07:00",
  status: "on_time",
  gate: "14A",
  delayMin: 0,
};

beforeEach(async () => {
  await __resetStore();
});

describe("GET /api/healthz", () => {
  it("returns {ok, sessions}", async () => {
    await testApiHandler({
      appHandler: healthz,
      async test({ fetch }) {
        const res = await fetch({ method: "GET" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(typeof body.sessions).toBe("number");
      },
    });
  });
});

describe("POST /api/session", () => {
  it("creates a session and returns the public shape (+ requesterKey once)", async () => {
    await testApiHandler({
      appHandler: session,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.sessionId).toBeTruthy();
        expect(body.roomName).toMatch(/^wingbuddy-/);
        expect(body.requesterKey).toBeTruthy();
        expect(body.t).toContain(".");
        expect(body.shareCode).toHaveLength(6);
        expect(body.flight.carrier).toBe("UA");
        expect(body.flightSource).toBe("sabre"); // mock seed succeeds
        expect(body.sabreMode).toBe("mock");
      },
    });
  });
});

describe("GET /api/voice-token", () => {
  it("mints a token for the requester with a valid x-wb-key", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    await testApiHandler({
      appHandler: voiceToken,
      url: `/api/voice-token?sessionId=${s.sessionId}&role=requester`,
      async test({ fetch }) {
        const res = await fetch({
          method: "GET",
          headers: { "x-wb-key": s.requesterKey },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token).toContain("vb-test-token-requester");
        expect(body.roomName).toBe(s.roomName);
      },
    });
  });

  it("401s the requester without a valid key", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    await testApiHandler({
      appHandler: voiceToken,
      url: `/api/voice-token?sessionId=${s.sessionId}&role=requester`,
      async test({ fetch }) {
        const res = await fetch({ method: "GET", headers: { "x-wb-key": "wrong" } });
        expect(res.status).toBe(401);
      },
    });
  });

  it("401s a joiner without a `t` token, 200 with a valid one", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });

    await testApiHandler({
      appHandler: voiceToken,
      url: `/api/voice-token?sessionId=${s.sessionId}&role=joiner`,
      async test({ fetch }) {
        const res = await fetch({ method: "GET" });
        expect(res.status).toBe(401);
      },
    });

    const t = signAccessToken(s.sessionId);
    await testApiHandler({
      appHandler: voiceToken,
      url: `/api/voice-token?sessionId=${s.sessionId}&role=joiner&t=${encodeURIComponent(t)}`,
      async test({ fetch }) {
        const res = await fetch({ method: "GET" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token).toContain("vb-test-token-joiner");
      },
    });
  });

  it("400s on a bad role", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    await testApiHandler({
      appHandler: voiceToken,
      url: `/api/voice-token?sessionId=${s.sessionId}&role=bogus`,
      async test({ fetch }) {
        const res = await fetch({ method: "GET" });
        expect(res.status).toBe(400);
      },
    });
  });
});

// CORS is applied by middleware.ts in the real runtime and validated end-to-end
// by scripts/smoke.sh; the decision logic is unit-tested in
// lib/__tests__/withCors.test.ts. (NTARH runs middleware in an edge-like context
// without the test env, so route-level CORS assertions here were unreliable.)
