import { NextResponse } from "next/server";
import { getSession, appendEvent } from "@/lib/session-store";
import { hasRequesterKey } from "@/lib/request-auth";
import { translate, type Lang } from "@/lib/translate";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

type Role = "traveler" | "agent" | "joiner";

export const POST = withCors(
  async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
    const { sessionId } = await ctx.params;
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    if (!hasRequesterKey(req, session)) {
      return NextResponse.json({ error: "invalid requesterKey" }, { status: 401 });
    }

    let body: { role?: Role; lang?: string; text?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }
    const role = body.role;
    const lang = body.lang;
    const text = body.text?.trim();
    if (!role || !lang || !text) {
      return NextResponse.json(
        { error: "role, lang, text required" },
        { status: 400 }
      );
    }

    // Translate to the opposite language when it's a supported pair.
    let textTranslated: string | undefined;
    if (lang === "hi" || lang === "en") {
      const dst: Lang = lang === "hi" ? "en" : "hi";
      const r = await translate(text, lang, dst);
      if (r.translated) textTranslated = r.text;
    }

    const event = await appendEvent(session, {
      type: "transcript",
      role,
      lang,
      text,
      textTranslated,
    });

    return NextResponse.json({ ok: true, seq: event.seq }, { status: 201 });
  }
);

export const OPTIONS = corsPreflight;
