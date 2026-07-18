import { describe, it, expect, beforeEach } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import * as joinRoute from "@/app/api/join/route";
import {
  createSession,
  getSession,
  __resetStore,
  type Flight,
} from "@/lib/session-store";
import { signAccessToken, hashPin } from "@/lib/access";

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

async function post(body: unknown) {
  let out: Response;
  await testApiHandler({
    appHandler: joinRoute,
    async test({ fetch }) {
      out = await fetch({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },
  });
  return out!;
}

describe("POST /api/join", () => {
  it("verifies a valid signed `t` link", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    const original = signAccessToken(s.sessionId);
    const res = await post({ t: original });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ sessionId: s.sessionId, verified: true });
    expect(typeof body.t).toBe("string");
    expect(body.t).toContain(".");
    // Fresh TTL token (may differ from the link token).
    const after = await getSession(s.sessionId);
    expect(after?.presence.joiner).toBe(true);
  });

  it("rejects an invalid token", async () => {
    const res = await post({ t: "garbage" });
    expect(res.status).toBe(401);
  });

  it("verifies via shareCode with no PIN and mints a fresh `t`", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    const res = await post({ shareCode: s.shareCode.toLowerCase() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe(s.sessionId);
    expect(body.t).toContain(".");
  });

  it("requires the correct PIN when one is set", async () => {
    const s = await createSession({ flight: { ...FLIGHT }, pinHash: hashPin("4242") });
    expect((await post({ shareCode: s.shareCode })).status).toBe(401);
    expect((await post({ shareCode: s.shareCode, pin: "0000" })).status).toBe(401);
    const ok = await post({ shareCode: s.shareCode, pin: "4242" });
    expect(ok.status).toBe(200);
  });

  it("404s an unknown shareCode, 400s an empty request", async () => {
    expect((await post({ shareCode: "ZZZZZZ" })).status).toBe(404);
    expect((await post({})).status).toBe(400);
  });
});
