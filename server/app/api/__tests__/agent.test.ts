import { describe, it, expect, beforeEach } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";
import * as agentRoute from "@/app/api/agent/route";
import * as disruptRoute from "@/app/api/demo/disrupt/route";
import {
  createSession,
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

beforeEach(() => __resetStore());

async function ask(sessionId: string, key: string | null, query: string) {
  let res: Response;
  await testApiHandler({
    appHandler: agentRoute,
    async test({ fetch }) {
      res = await fetch({
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(key ? { "x-wb-key": key } : {}),
        },
        body: JSON.stringify({ sessionId, query }),
      });
    },
  });
  return res!;
}

describe("POST /api/agent", () => {
  it("wheelchair intent returns Hindi + reconfirms SSR", async () => {
    const s = mk();
    const res = await ask(s.sessionId, s.requesterKey, "मुझे व्हीलचेयर चाहिए");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.intent).toBe("wheelchair");
    expect(body.ssr).toBe("reconfirmed");
    expect(body.answer).toContain("व्हीलचेयर");
  });

  it("medical query is declined without advice", async () => {
    const s = mk();
    const res = await ask(s.sessionId, s.requesterKey, "how much medicine should I take");
    const body = await res.json();
    expect(body.intent).toBe("medical_decline");
    expect(body.answer).not.toMatch(/\d+\s*mg/i);
  });

  it("401s without the requesterKey; 404 for unknown session", async () => {
    const s = mk();
    expect((await ask(s.sessionId, null, "hi")).status).toBe(401);
    expect((await ask("nope", s.requesterKey, "hi")).status).toBe(404);
  });

  it("full gasp cycle: disrupt silently drops SSR, agent re-check flips it back", async () => {
    const s = mk();
    const t = signAccessToken(s.sessionId);

    // presenter presses `d`
    await testApiHandler({
      appHandler: disruptRoute,
      url: `/api/demo/disrupt?t=${encodeURIComponent(t)}`,
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "gate_change" }),
        });
        const b = await res.json();
        expect(b.ssr).toBe("dropped");
      },
    });

    // agent re-checks (as the client would after seeing flight_update)
    const res = await ask(s.sessionId, s.requesterKey, "गेट बदल गया, फिर से देखिए");
    const body = await res.json();
    expect(body.intent).toBe("flight_recheck");
    expect(body.ssr).toBe("reconfirmed");
    // badge story: ...dropped (silent, via state) -> reconfirmed (ssr_update)
    const lastSsr = s.events.filter((e) => e.type === "ssr_update").at(-1);
    expect(lastSsr).toMatchObject({ value: "reconfirmed" });
  });
});
