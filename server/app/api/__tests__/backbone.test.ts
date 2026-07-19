import { describe, it, expect, beforeEach } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";

import * as stateRoute from "@/app/api/session/[sessionId]/state/route";
import * as eventsRoute from "@/app/api/session/[sessionId]/events/route";
import * as transcriptRoute from "@/app/api/session/[sessionId]/transcript/route";
import * as disruptRoute from "@/app/api/demo/disrupt/route";
import * as relayRoute from "@/app/api/relay/route";

import {
  createSession,
  getSession,
  appendEvent,
  __resetStore,
  type Flight,
} from "@/lib/session-store";
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

const mk = () => createSession({ flight: { ...FLIGHT } });

beforeEach(async () => {
  await __resetStore();
});

describe("GET /api/session/[id]/state", () => {
  it("returns a snapshot for a valid requesterKey", async () => {
    const s = await mk();
    await testApiHandler({
      appHandler: stateRoute,
      params: { sessionId: s.sessionId },
      async test({ fetch }) {
        const res = await fetch({ method: "GET", headers: { "x-wb-key": s.requesterKey } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.flight.gate).toBe("14A");
        expect(body.ssr).toBe("none");
        expect(body.presence).toEqual({ requester: false, joiner: false });
        expect(body.seq).toBe(0);
      },
    });
  });

  it("accepts a valid `t` token too", async () => {
    const s = await mk();
    const t = signAccessToken(s.sessionId);
    await testApiHandler({
      appHandler: stateRoute,
      params: { sessionId: s.sessionId },
      url: `/api/session/${s.sessionId}/state?t=${encodeURIComponent(t)}`,
      async test({ fetch }) {
        const res = await fetch({ method: "GET" });
        expect(res.status).toBe(200);
      },
    });
  });

  it("401s without credentials, 404s for unknown session", async () => {
    const s = await mk();
    await testApiHandler({
      appHandler: stateRoute,
      params: { sessionId: s.sessionId },
      async test({ fetch }) {
        expect((await fetch({ method: "GET" })).status).toBe(401);
      },
    });
    await testApiHandler({
      appHandler: stateRoute,
      params: { sessionId: "nope" },
      async test({ fetch }) {
        expect(
          (await fetch({ method: "GET", headers: { "x-wb-key": s.requesterKey } })).status
        ).toBe(404);
      },
    });
  });
});

describe("GET /api/session/[id]/events", () => {
  it("returns only events newer than `since`", async () => {
    const s = await mk();
    await appendEvent(s, { type: "agent_action", label: "a" });
    await appendEvent(s, { type: "agent_action", label: "b" });
    await appendEvent(s, { type: "agent_action", label: "c" });
    await testApiHandler({
      appHandler: eventsRoute,
      params: { sessionId: s.sessionId },
      url: `/api/session/${s.sessionId}/events?since=1`,
      async test({ fetch }) {
        const res = await fetch({ method: "GET", headers: { "x-wb-key": s.requesterKey } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.events.map((e: { seq: number }) => e.seq)).toEqual([2, 3]);
        expect(body.seq).toBe(3);
      },
    });
  });
});

describe("POST /api/session/[id]/transcript", () => {
  it("logs + translates a Hindi line (requesterKey required)", async () => {
    const s = await mk();
    await testApiHandler({
      appHandler: transcriptRoute,
      params: { sessionId: s.sessionId },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "x-wb-key": s.requesterKey, "content-type": "application/json" },
          body: JSON.stringify({
            role: "traveler",
            lang: "hi",
            text: "मुझे दवाई के लिए पानी चाहिए",
          }),
        });
        expect(res.status).toBe(201);
      },
    });
    const ev = (await getSession(s.sessionId))!.events.at(-1);
    expect(ev?.type).toBe("transcript");
    expect(ev && ev.type === "transcript" && ev.textTranslated).toBe(
      "I need water for my medicine"
    );
  });

  it("401s without the requesterKey", async () => {
    const s = await mk();
    await testApiHandler({
      appHandler: transcriptRoute,
      params: { sessionId: s.sessionId },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role: "traveler", lang: "hi", text: "x" }),
        });
        expect(res.status).toBe(401);
      },
    });
  });
});

describe("POST /api/demo/disrupt", () => {
  it("gate_change mutates flight + silently drops SSR (no ssr_update event)", async () => {
    const s = await mk();
    const t = signAccessToken(s.sessionId);
    await testApiHandler({
      appHandler: disruptRoute,
      url: `/api/demo/disrupt?t=${encodeURIComponent(t)}`,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "gate_change" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.flight.gate).toBe("22B");
        expect(body.ssr).toBe("dropped");
      },
    });
    const after = (await getSession(s.sessionId))!;
    const types = after.events.map((e) => e.type);
    expect(types).toContain("flight_event");
    expect(types).toContain("flight_update");
    expect(types).not.toContain("ssr_update"); // silent drop
    expect(after.ssr).toBe("dropped");
  });

  it("401s with an invalid token", async () => {
    await testApiHandler({
      appHandler: disruptRoute,
      url: `/api/demo/disrupt?t=garbage`,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "gate_change" }),
        });
        expect(res.status).toBe(401);
      },
    });
  });
});

describe("POST /api/relay", () => {
  it("appends a family_message event (name prefixed)", async () => {
    const s = await mk();
    const t = signAccessToken(s.sessionId);
    await testApiHandler({
      appHandler: relayRoute,
      url: `/api/relay?t=${encodeURIComponent(t)}`,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "Are you okay?", name: "Raj" }),
        });
        expect(res.status).toBe(201);
      },
    });
    // A question relay also appends an agent reply afterward, so find the
    // family_message rather than assuming it's the last event.
    const evs = (await getSession(s.sessionId))!.events;
    const ev = evs.find((e) => e.type === "family_message");
    expect(ev?.type).toBe("family_message");
    expect(ev && ev.type === "family_message" && ev.text).toBe("Raj: Are you okay?");
  });

  it("401s without a valid token", async () => {
    await testApiHandler({
      appHandler: relayRoute,
      url: `/api/relay`,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "hi" }),
        });
        expect(res.status).toBe(401);
      },
    });
  });
});
