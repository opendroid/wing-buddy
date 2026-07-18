import { NextResponse } from "next/server";

// GET /api/healthz — Cloud Run liveness (PLAN-v2 §4.1 #10).
export async function GET() {
  return NextResponse.json({ ok: true });
}
