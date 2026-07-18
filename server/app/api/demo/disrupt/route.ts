import { NextResponse } from "next/server";
import { getSession, appendEvent, mutateSession } from "@/lib/session-store";
import { sessionIdFromT } from "@/lib/request-auth";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

type DisruptKind = "gate_change" | "delay";

// Presenter presses `d` on the joiner dashboard. Mutates the flight and
// SILENTLY drops the wheelchair SSR (no ssr_update event) — the agent notices
// on its next re-check (M3) and re-adds it. Emits flight_event + flight_update
// only; the dashboard re-hydrates /state to see ssr:"dropped" (badge -> warn).
export const POST = withCors(async (req: Request) => {
  const url = new URL(req.url);
  const sessionId = sessionIdFromT(url);
  if (!sessionId) {
    return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
  }
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  let kind: DisruptKind;
  try {
    const body = (await req.json()) as { kind?: DisruptKind };
    kind = body.kind === "delay" ? "delay" : "gate_change";
  } catch {
    kind = "gate_change";
  }

  if (kind === "gate_change") {
    const newGate = session.flight.gate === "14A" ? "22B" : "14A";
    await mutateSession(session, (s) => {
      s.flight.gate = newGate;
      s.ssr = "dropped"; // silent
    });
    await appendEvent(session, { type: "flight_event", kind: "gate_change", gate: newGate });
    await appendEvent(session, { type: "flight_update", kind: "gate_change", gate: newGate });
  } else {
    const delayMin = (session.flight.delayMin || 0) + 45;
    await mutateSession(session, (s) => {
      s.flight.delayMin = delayMin;
      s.flight.status = "delayed";
      s.ssr = "dropped"; // silent
    });
    await appendEvent(session, { type: "flight_event", kind: "delay", delayMin });
    await appendEvent(session, { type: "flight_update", kind: "delay", delayMin });
  }

  return NextResponse.json({
    ok: true,
    kind,
    flight: session.flight,
    ssr: session.ssr,
    seq: session.seq,
  });
});

export const OPTIONS = corsPreflight;
