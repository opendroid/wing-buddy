import { NextResponse } from "next/server";
import {
  getSession,
  getSessionByShareCode,
  appendEvent,
  mutateSession,
} from "@/lib/session-store";
import { verifyAccessToken, verifyPin, signAccessToken } from "@/lib/access";

export const dynamic = "force-dynamic";

async function markJoinerPresent(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return;
  if (!session.presence.joiner) {
    await mutateSession(session, (s) => {
      s.presence.joiner = true;
    });
    await appendEvent(session, {
      type: "presence",
      who: "joiner",
      kind: "joined",
    });
  }
}

// Verify joiner access. Primary: a signed `t` link. Fallback: shareCode (+ PIN
// if the requester opted in). On success returns { sessionId, verified, `t` —
// a freshly signed token the joiner uses for state / events / relay.
export async function POST(req: Request) {
  let body: { t?: string; shareCode?: string; pin?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Primary: signed link token — mint a fresh `t` so mid-call opens stay valid.
  if (body.t) {
    const v = verifyAccessToken(body.t);
    if (!v || !(await getSession(v.sessionId))) {
      return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
    }
    await markJoinerPresent(v.sessionId);
    return NextResponse.json({
      sessionId: v.sessionId,
      verified: true,
      t: signAccessToken(v.sessionId),
    });
  }

  // Fallback: shareCode (+ optional PIN).
  if (body.shareCode) {
    const session = await getSessionByShareCode(body.shareCode);
    if (!session) {
      return NextResponse.json({ error: "unknown code" }, { status: 404 });
    }
    if (session.pinHash) {
      if (!body.pin || !verifyPin(body.pin, session.pinHash)) {
        return NextResponse.json({ error: "invalid PIN" }, { status: 401 });
      }
    }
    await markJoinerPresent(session.sessionId);
    return NextResponse.json({
      sessionId: session.sessionId,
      verified: true,
      t: signAccessToken(session.sessionId),
    });
  }

  return NextResponse.json({ error: "t or shareCode required" }, { status: 400 });
}
