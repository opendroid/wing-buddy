import { NextResponse } from "next/server";
import { getSession, eventsSince } from "@/lib/session-store";
import { canReadSession } from "@/lib/request-auth";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

export const GET = withCors(
  async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
    const { sessionId } = await ctx.params;
    const url = new URL(req.url);
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    if (!canReadSession(req, url, session)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const since = Number(url.searchParams.get("since") ?? "0");
    const events = eventsSince(session, Number.isFinite(since) ? since : 0);
    return NextResponse.json({ events, seq: session.seq });
  }
);

export const OPTIONS = corsPreflight;
