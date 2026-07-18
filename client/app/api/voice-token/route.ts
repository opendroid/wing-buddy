import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/session-store";
import { verifyToken } from "@/lib/access";
import { placeholderToken, vbApiKeyPresent } from "@/lib/vocalbridge";

// GET /api/voice-token?sessionId=..&role=requester|joiner
// Mint a VB/LiveKit token into the shared room_name (PLAN-v2 §4.1 #2).
// role=joiner requires a verified signed `t` token (or will, at Spike A).
// For Hour 1 we return a placeholder-shaped token; real minting lands at Spike A.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const role = searchParams.get("role");

  if (!sessionId || (role !== "requester" && role !== "joiner")) {
    return NextResponse.json(
      { error: "sessionId and role (requester|joiner) are required" },
      { status: 400 },
    );
  }

  const session = getStore().get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  if (role === "joiner") {
    const t = req.headers.get("x-wb-token") || searchParams.get("t");
    const verified = verifyToken(t);
    if (!verified || verified !== sessionId) {
      return NextResponse.json({ error: "unauthorized joiner" }, { status: 401 });
    }
  }

  const identity = role === "requester" ? "requester" : "joiner";
  const token = placeholderToken(session.roomName, identity);

  return NextResponse.json({
    ...token,
    liveMinting: vbApiKeyPresent(),
    note: "placeholder token — real minting wired at Spike A",
  });
}
