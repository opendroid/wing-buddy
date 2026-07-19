import { NextResponse } from "next/server";
import { getSession, appendEvent } from "@/lib/session-store";
import { sessionIdFromT } from "@/lib/request-auth";
import { handleQuery } from "@/lib/brain";
import { translate } from "@/lib/translate";
export const dynamic = "force-dynamic";

// A relayed message is treated as a question (worth an agent reply) if it ends
// with "?" or opens with a question word — English or Hindi. Statements like
// "we love you, Mom" are relayed to the traveler without a canned answer.
function looksLikeQuestion(text: string): boolean {
  return /\?|^\s*(what|where|when|why|how|who|which|is|are|does|do|can|could|will|would|has|have|whose)\b/i.test(
    text
  ) || /क्या|कहाँ|कहां|कब|कैसे|कौन|क्यों|कितन/.test(text);
}

// Joiner types a message; we append a family_message event. The requester client
// picks it up on poll and converts it into an app->agent client action, which
// the hosted VB agent relays to the traveler in Hindi (CLAUDE.md rule 4b).
export async function POST(req: Request) {
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

  // If the family's message is a question, answer it and log the reply — so the
  // joiner sees a response even when no requester client is bridging. In-scope
  // questions get a real answer; out-of-scope questions get an honest fallback
  // (never silence). Plain relays ("we love you, Mom") get no canned answer.
  try {
    const { intent, answer } = await handleQuery(session, raw);
    let reply: string | null = null;
    if (intent !== "reassure") {
      reply = answer;
    } else if (looksLikeQuestion(raw)) {
      reply =
        "मेरे पास यह जानकारी नहीं है, पर मैं फ्लाइट, गेट, सीट, या व्हीलचेयर के बारे में बता सकती हूँ।";
    }
    if (reply) {
      const tr = await translate(reply, "hi", "en");
      await appendEvent(session, {
        type: "transcript",
        role: "agent",
        lang: "hi",
        text: reply,
        textTranslated: tr.translated ? tr.text : undefined,
      });
    }
  } catch {
    /* brain failure shouldn't fail the relay */
  }

  return NextResponse.json({ ok: true, seq: event.seq }, { status: 201 });
}
