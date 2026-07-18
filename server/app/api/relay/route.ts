import { NextResponse } from "next/server";
import { getSession, appendEvent } from "@/lib/session-store";
import { sessionIdFromT } from "@/lib/request-auth";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

// Joiner types a message; we append a family_message event. The requester client
// picks it up on poll and converts it into an app->agent client action, which
// the hosted VB agent relays to the traveler in Hindi (CLAUDE.md rule 4b).
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

  let body: { text?: string; name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const raw = body.text?.trim();
  if (!raw) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const name = body.name?.trim();
  const text = name ? `${name}: ${raw}` : raw;

  const event = await appendEvent(session, { type: "family_message", text });
  return NextResponse.json({ ok: true, seq: event.seq }, { status: 201 });
});

export const OPTIONS = corsPreflight;
