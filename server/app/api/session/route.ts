import { NextResponse } from "next/server";
import { createSession, type Flight } from "@/lib/session-store";
import { signAccessToken, hashPin } from "@/lib/access";
import { seedFlight } from "@/lib/sabre";
import { sabreMode } from "@/lib/sabre";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

// Deterministic fallback flight if real Sabre seeding fails (plan §Sabre).
const FALLBACK_FLIGHT: Flight = {
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

export const POST = withCors(async (req: Request) => {
  let pin: string | undefined;
  try {
    const body = (await req.json()) as { pin?: string } | null;
    pin = body?.pin?.trim() || undefined;
  } catch {
    // no body is fine
  }

  // Seed the flight from real Sabre; fall back to the deterministic mock on any
  // error so session creation never hard-depends on live Sabre.
  let flight: Flight;
  let flightSource: "sabre" | "fallback";
  try {
    flight = await seedFlight();
    flightSource = "sabre";
  } catch {
    flight = { ...FALLBACK_FLIGHT };
    flightSource = "fallback";
  }

  const session = await createSession({
    flight,
    pinHash: pin ? hashPin(pin) : undefined,
  });

  const t = signAccessToken(session.sessionId);

  return NextResponse.json(
    {
      sessionId: session.sessionId,
      roomName: session.roomName,
      requesterKey: session.requesterKey, // returned ONCE
      t,
      shareCode: session.shareCode,
      flight: session.flight,
      flightSource,
      sabreMode: sabreMode(),
    },
    { status: 201 }
  );
});

export const OPTIONS = corsPreflight;
