import { NextResponse } from "next/server";
import { getSession, getSessionByShareCode } from "@/lib/session-store";
import { verifyAccessToken, verifyPin, signAccessToken } from "@/lib/access";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

// Verify joiner access. Primary: a signed `t` link. Fallback: shareCode (+ PIN
// if the requester opted in). On success returns { sessionId, verified, t } —
// a fresh token the joiner uses for voice-token / state / events.
export const POST = withCors(async (req: Request) => {
  let body: { t?: string; shareCode?: string; pin?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Primary: signed link token.
  if (body.t) {
    const v = verifyAccessToken(body.t);
    if (!v || !(await getSession(v.sessionId))) {
      return NextResponse.json({ error: "invalid or expired token" }, { status: 401 });
    }
    return NextResponse.json({ sessionId: v.sessionId, verified: true, t: body.t });
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
    return NextResponse.json({
      sessionId: session.sessionId,
      verified: true,
      t: signAccessToken(session.sessionId),
    });
  }

  return NextResponse.json({ error: "t or shareCode required" }, { status: 400 });
});

export const OPTIONS = corsPreflight;
