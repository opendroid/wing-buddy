import crypto from "node:crypto";

// Access helpers (CLAUDE.md §auth). Two credential kinds:
//  - requesterKey: one-time secret returned by POST /api/session, sent as x-wb-key.
//  - signed `t` token: stateless HMAC over `sessionId|exp`, TTL-checked.
// Secret sourced from ACCESS_TOKEN_SECRET (set in .env.local / Secret Manager).

const DEFAULT_SECRET = "dev-only-insecure-secret-change-me";
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function secret(): string {
  return process.env.ACCESS_TOKEN_SECRET || DEFAULT_SECRET;
}

function hmac(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("hex");
}

/** One-time random key for the requester (sent as x-wb-key). */
export function makeRequesterKey(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Sign a session id into a short-TTL access token `t`. */
export function signToken(sessionId: string, ttlMs: number = TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = `${sessionId}|${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(payload)}`;
}

/** Verify a signed `t` token; returns the sessionId or null if invalid/expired. */
export function verifyToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const [sessionId, expStr] = payload.split("|");
  if (!sessionId || !expStr) return null;
  if (hmac(payload) !== sig) return null;
  if (Number(expStr) < Date.now()) return null;
  return sessionId;
}

/** Constant-time-ish share-code / PIN check helper. */
export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(`pin:${pin}`).digest("hex");
}

export function verifyPin(pinHash: string | undefined, pin: string | undefined): boolean {
  if (!pinHash) return true; // no PIN set -> any (or empty) passes
  if (!pin) return false;
  return hashPin(pin) === pinHash;
}
