import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";
import { verifyRequesterKey, verifyAccessToken } from "@/lib/access";
import { mintVoiceToken } from "@/lib/vocalbridge";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

export const GET = withCors(async (req: Request) => {
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
    return NextResponse.json({
      token: voice.token,
      roomName: voice.roomName ?? session.roomName,
      url: voice.url,
      role,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "voice token mint failed", detail: String(err) },
      { status: 502 }
    );
  }
});

export const OPTIONS = corsPreflight;
