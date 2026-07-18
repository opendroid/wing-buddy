import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";
import { hasRequesterKey } from "@/lib/request-auth";
import { handleQuery } from "@/lib/brain";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

// The brain. Reached via the SDK delegation path: hosted VB agent -> the
// requester client's onAIAgentQuery -> POST /api/agent {sessionId, query} ->
// {answer} (Hindi) -> spoken. No server->VB webhook.
export const POST = withCors(async (req: Request) => {
  let body: { sessionId?: string; query?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const sessionId = body.sessionId;
  const query = body.query?.trim();
  if (!sessionId || !query) {
    return NextResponse.json({ error: "sessionId and query required" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (!hasRequesterKey(req, session)) {
    return NextResponse.json({ error: "invalid requesterKey" }, { status: 401 });
  }

  const { intent, answer } = await handleQuery(session, query);
  return NextResponse.json({ answer, intent, ssr: session.ssr, seq: session.seq });
});

export const OPTIONS = corsPreflight;
