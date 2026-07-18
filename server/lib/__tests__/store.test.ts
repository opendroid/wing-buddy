import { describe, it, expect, beforeEach } from "vitest";
import {
  createSession,
  getSession,
  appendEvent,
  eventsSince,
  mutateSession,
  sessionCount,
  __resetStore,
  type Flight,
} from "@/lib/session-store";
import { MAX_EVENTS } from "@/lib/events";

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

describe("session-store", () => {
  it("creates sessions with unique ids, a room name, key and share code", async () => {
    const a = await createSession({ flight: { ...FLIGHT } });
    const b = await createSession({ flight: { ...FLIGHT } });
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(a.roomName).toMatch(/^wingbuddy-/);
    expect(a.requesterKey).toBeTruthy();
    expect(a.shareCode).toHaveLength(6);
    expect(a.ssr).toBe("none");
    expect(await sessionCount()).toBe(2);
  });

  it("get miss returns undefined", async () => {
    expect(await getSession("nope")).toBeUndefined();
  });

  it("mutate flows through the callback", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    await mutateSession(s, (x) => {
      x.ssr = "dropped";
      x.presence.joiner = true;
    });
    expect((await getSession(s.sessionId))?.ssr).toBe("dropped");
    expect((await getSession(s.sessionId))?.presence.joiner).toBe(true);
  });
});

describe("events", () => {
  it("assigns strictly monotonic seq and timestamps", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    const e1 = await appendEvent(s, { type: "agent_action", label: "one" });
    const e2 = await appendEvent(s, { type: "ssr_update", value: "confirmed" });
    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(e2.ts).toBeGreaterThanOrEqual(e1.ts);
    expect(s.seq).toBe(2);
  });

  it("eventsSince returns only events newer than `since`", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    await appendEvent(s, { type: "agent_action", label: "a" });
    await appendEvent(s, { type: "agent_action", label: "b" });
    await appendEvent(s, { type: "agent_action", label: "c" });
    const after1 = eventsSince(s, 1);
    expect(after1.map((e) => e.seq)).toEqual([2, 3]);
    expect(eventsSince(s, 3)).toEqual([]);
  });

  it("caps the event log at MAX_EVENTS, dropping the oldest, seq stays monotonic", async () => {
    const s = await createSession({ flight: { ...FLIGHT } });
    for (let i = 0; i < MAX_EVENTS + 25; i++) {
      await appendEvent(s, { type: "agent_action", label: `e${i}` });
    }
    expect(s.events.length).toBe(MAX_EVENTS);
    // oldest dropped: first retained seq is 26
    expect(s.events[0].seq).toBe(26);
    expect(s.events[s.events.length - 1].seq).toBe(MAX_EVENTS + 25);
    expect(s.seq).toBe(MAX_EVENTS + 25);
  });
});
