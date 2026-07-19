import { describe, it, expect, beforeEach } from "vitest";
import { classifyIntent, isMedicalAdvice, handleQuery } from "@/lib/brain";
import {
  createSession,
  mutateSession,
  __resetStore,
  type Flight,
  type Session,
} from "@/lib/session-store";

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

describe("classifyIntent", () => {
  it("routes the main intents", () => {
    expect(classifyIntent("I need a wheelchair")).toBe("wheelchair");
    expect(classifyIntent("मुझे व्हीलचेयर चाहिए")).toBe("wheelchair");
    expect(classifyIntent("how much medicine should I take")).toBe("medical_decline");
    expect(classifyIntent("मुझे बुखार है")).toBe("medical_decline");
    // water-for-medicine is a facility ask, NOT medical advice
    expect(classifyIntent("मुझे दवाई के लिए पानी चाहिए")).toBe("facilities");
    expect(classifyIntent("my gate changed, गेट बदल गया")).toBe("flight_recheck");
    expect(classifyIntent("what is my flight status")).toBe("flight_status");
    expect(classifyIntent("what is her seat")).toBe("seat");
    expect(classifyIntent("मेरी सीट कौन सी है")).toBe("seat");
    expect(classifyIntent("please tell my family")).toBe("notify_family");
    expect(classifyIntent("hello")).toBe("reassure");
  });

  it("isMedicalAdvice fires on symptoms or dosing+medicine, not plain facility asks", () => {
    expect(isMedicalAdvice("I have chest pain")).toBe(true);
    expect(isMedicalAdvice("how many pills")).toBe(true);
    expect(isMedicalAdvice("water for my medicine")).toBe(false);
  });
});

describe("handleQuery", () => {
  it("wheelchair → files WCHR, ssr reconfirmed, emits agent_action + ssr_update", async () => {
    const s = await mk();
    const r = await handleQuery(s, "I need a wheelchair");
    expect(r.intent).toBe("wheelchair");
    expect(s.ssr).toBe("reconfirmed");
    const types = s.events.map((e) => e.type);
    expect(types).toContain("agent_action");
    expect(types).toContain("ssr_update");
  });

  it("flight_recheck after a silent drop re-adds WCHR → reconfirmed", async () => {
    const s = await mk();
    await mutateSession(s, (x) => {
      x.ssr = "dropped"; // as if /demo/disrupt fired
      x.flight.gate = "22B";
    });
    const r = await handleQuery(s, "गेट बदल गया, फिर से देखिए");
    expect(r.intent).toBe("flight_recheck");
    expect(s.ssr).toBe("reconfirmed");
    const ssrUpdates = s.events.filter((e) => e.type === "ssr_update");
    expect(ssrUpdates.at(-1)).toMatchObject({ type: "ssr_update", value: "reconfirmed" });
    expect(r.answer).toContain("22B");
  });

  it("medical query → declines, no advice, logs the decline", async () => {
    const s = await mk();
    const r = await handleQuery(s, "how much medicine should I take");
    expect(r.intent).toBe("medical_decline");
    expect(r.answer).toContain("सलाह नहीं दे सकती"); // "cannot advise"
    // no medical dosing content leaked
    expect(r.answer).not.toMatch(/\d+\s*mg/i);
    expect(s.events.some((e) => e.type === "agent_action")).toBe(true);
  });

  it("facilities (water for medicine) → facilities event, not a decline", async () => {
    const s = await mk();
    const r = await handleQuery(s, "मुझे दवाई के लिए पानी चाहिए");
    expect(r.intent).toBe("facilities");
    const fac = s.events.find((e) => e.type === "facilities");
    expect(fac).toMatchObject({ type: "facilities", need: "water", airport: "SFO" });
  });

  it("seat → returns the seat assignment", async () => {
    const s = await mk();
    await mutateSession(s, (x) => {
      x.flight.seat = "12C";
    });
    const r = await handleQuery(s, "what is her seat");
    expect(r.intent).toBe("seat");
    expect(r.answer).toContain("12C");
    expect(s.events.some((e) => e.type === "agent_action")).toBe(true);
  });

  it("ends reassurances with the calm sign-off", async () => {
    const s = await mk();
    const r = await handleQuery(s, "hello");
    expect(r.answer).toContain("आप ठीक कर रहे हैं");
  });
});
