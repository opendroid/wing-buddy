import { NextResponse } from "next/server";
import { getSession, appendEvent, mutateSession } from "@/lib/session-store";
import { verifyRequesterKey, verifyAccessToken } from "@/lib/access";
import { mintVoiceToken } from "@/lib/vocalbridge";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const role = url.searchParams.get("role");

  if (!sessionId || (role !== "requester" && role !== "joiner")) {
    return NextResponse.json(
      { error: "sessionId and role=requester|joiner required" },
      { status: 400 }
    );
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  // Auth: requester → x-wb-key; joiner → verified signed `t`.
  if (role === "requester") {
    const key = req.headers.get("x-wb-key");
    if (!key || !verifyRequesterKey(key, session.requesterKey)) {
      return NextResponse.json({ error: "invalid requesterKey" }, { status: 401 });
    }
  } else {
    const t = url.searchParams.get("t");
    const verified = verifyAccessToken(t);
    if (!verified || verified.sessionId !== sessionId) {
      return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
    }
  }

  try {
    const voice = await mintVoiceToken({
      participantName: role,
      roomName: session.roomName,
    });

    // Traveler connected to voice → family mid-joiners see "Traveler is connected".
    if (role === "requester" && !session.presence.requester) {
      await mutateSession(session, (s) => {
        s.presence.requester = true;
      });
      await appendEvent(session, {
        type: "presence",
        who: "requester",
        kind: "joined",
      });
    }

    // SDK TokenResponse: url (or livekit_url), token, room_name, …
    // Plus legacy camelCase aliases used by older clients/tests.
    return NextResponse.json({
      token: voice.token,
      url: voice.url,
      livekit_url: voice.url,
      room_name: voice.room_name,
      roomName: voice.roomName,
      participant_identity: voice.participant_identity,
      expires_in: voice.expires_in,
      agent_mode: voice.agent_mode,
      role,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "voice token mint failed", detail: String(err) },
      { status: 502 }
    );
  }
}
