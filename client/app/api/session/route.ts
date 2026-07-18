import { NextRequest, NextResponse } from "next/server";
import { getStore, newSessionId, makeRoomName, seedSession } from "@/lib/session-store";
import { makeRequesterKey, signToken, hashPin } from "@/lib/access";

// POST /api/session — create a session (PLAN-v2 §4.1 #1).
// Returns sessionId, room_name, signed access token `t`, requesterKey, shareCode,
// seeded mock flight. No auth required (creates).
export async function POST(req: NextRequest) {
  let pin: string | undefined;
  try {
    const body = await req.json();
    pin = body?.pin;
  } catch {
    /* no body -> no PIN */
  }

  const sessionId = newSessionId();
  const roomName = makeRoomName(sessionId);
  const requesterKey = makeRequesterKey();
  const shareCode = Math.random().toString(36).slice(2, 8).toUpperCase();

  const session = seedSession({
    sessionId,
    roomName,
    requesterKey,
    shareCode,
    pinHash: pin ? hashPin(pin) : undefined,
  });

  getStore().create(session);

  return NextResponse.json({
    sessionId,
    room_name: roomName,
    accessToken: signToken(sessionId),
    requesterKey,
    shareCode,
    flight: session.flight,
  });
}
