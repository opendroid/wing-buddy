import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Stateless auth helpers (PLAN-v2 §4.1, CLAUDE.md:32):
//  - `t`: HMAC over `sessionId|exp`, verified without server state.
//  - requesterKey: opaque random key returned once by POST /api/session.

// Long enough for mid-call family joins during a live session (session store
// TTL is 24h). Links shared at the start of a call must still work later.
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function secret(): string {
  const s = process.env.ACCESS_TOKEN_SECRET;
  if (!s) throw new Error("ACCESS_TOKEN_SECRET is not set");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function mintRequesterKey(): string {
  return randomBytes(32).toString("base64url");
}

// Optional PIN (opt-in). Stored as an HMAC, compared in constant time.
export function hashPin(pin: string): string {
  return hmac(`pin:${pin}`);
}

export function verifyPin(pin: string, pinHash: string | undefined): boolean {
  if (!pinHash) return false;
  return safeEqual(hashPin(pin), pinHash);
}

export function verifyRequesterKey(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  return safeEqual(provided, expected);
}

// Returns a signed `t` token: `<b64url(payload)>.<hmac>` where payload = `sessionId|exp`.
export function signAccessToken(
  sessionId: string,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const exp = Date.now() + ttlMs;
  const payload = `${sessionId}|${exp}`;
  return `${b64url(payload)}.${hmac(payload)}`;
}

// Verifies signature + expiry. Returns { sessionId } or null.
export function verifyAccessToken(
  token: string | null | undefined
): { sessionId: string; exp: number } | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encodedPayload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  if (!safeEqual(sig, hmac(payload))) return null;

  const sep = payload.lastIndexOf("|");
  if (sep <= 0) return null;
  const sessionId = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  return { sessionId, exp };
}
