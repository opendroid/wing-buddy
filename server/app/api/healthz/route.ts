import { NextResponse } from "next/server";
import { sessionCount } from "@/lib/session-store";
import { withCors, corsPreflight } from "@/lib/withCors";

export const dynamic = "force-dynamic";

export const GET = withCors(async () => {
  return NextResponse.json({ ok: true, sessions: await sessionCount() });
});

export const OPTIONS = corsPreflight;
