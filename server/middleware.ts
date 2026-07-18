import { NextResponse, type NextRequest } from "next/server";
import { corsHeadersFor } from "@/lib/withCors";

// CORS for the cross-origin client, applied in the real Next runtime (per-route
// header setting is unreliable in production; middleware is the supported path).
// Handles preflight and stamps CORS headers on every /api/* response.
export function middleware(req: NextRequest) {
  const cors = corsHeadersFor(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
