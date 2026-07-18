import { EVENTS_CAP, type SSRState, type WBEvent } from "./events";

// Session state (PLAN-v2 §4.2). In-memory Map is only safe because Cloud Run
// runs ONE warm container (min=max=1). For Vercel serverless, swap the store
// implementation for a KV-backed one via SESSION_STORE=kv (seam below).

export interface Flight {
  carrier: string;
  number: string;
  date: string;
  origin: string;
  dest: string;
  schedDep: string;
  status: "on_time" | "delayed" | "cancelled";
  gate: string;
  delayMin: number;
}

export interface Session {
  sessionId: string;
  roomName: string;
  createdAt: number;
  requesterKey: string;
  shareCode: string;
  pinHash?: string;
  language: "hi";
  flight: Flight;
  ssr: SSRState;
  presence: { requester: boolean; joiner: boolean };
  seq: number;
  events: WBEvent[];
}

export interface SessionStore {
  get(sessionId: string): Session | undefined;
  create(session: Session): Session;
  appendEvent(sessionId: string, event: WBEvent): Session | undefined;
  mutate(sessionId: string, fn: (s: Session) => Session): Session | undefined;
}

function seededFlight(): Flight {
  return {
    carrier: "UA",
    number: "2348",
    date: new Date().toISOString().slice(0, 10),
    origin: "SFO",
    dest: "DEN",
    schedDep: "4:15pm",
    status: "on_time",
    gate: "14A",
    delayMin: 0,
  };
}

class InMemoryStore implements SessionStore {
  private map = new Map<string, Session>();

  get(sessionId: string) {
    return this.map.get(sessionId);
  }

  create(session: Session) {
    this.map.set(session.sessionId, session);
    return session;
  }

  appendEvent(sessionId: string, event: WBEvent) {
    const s = this.map.get(sessionId);
    if (!s) return undefined;
    s.events.push(event);
    if (s.events.length > EVENTS_CAP) s.events.splice(0, s.events.length - EVENTS_CAP);
    this.map.set(sessionId, s);
    return s;
  }

  mutate(sessionId: string, fn: (s: Session) => Session) {
    const s = this.map.get(sessionId);
    if (!s) return undefined;
    const next = fn(s);
    this.map.set(sessionId, next);
    return next;
  }
}

let store: SessionStore | undefined;

/**
 * Returns the active session store. Default = in-memory (Cloud Run safe).
 * Set SESSION_STORE=kv to use a KV-backed store (required for Vercel
 * serverless multi-instance). The kv branch is the swap seam — implement it
 * against Upstash/Redis/Vercel KV when needed; for now it falls back to memory
 * with a clear warning so the app still runs. Never run in-memory on Vercel
 * without max-instances=1.
 */
export function getStore(): SessionStore {
  if (store) return store;
  const kind = process.env.SESSION_STORE ?? "memory";
  if (kind === "kv") {
    // TODO(infra): implement KV-backed SessionStore here (Upstash/Redis/Vercel KV).
    // Until then, fall back to memory and warn — do NOT silently lose state on
    // a multi-instance runtime.
    console.warn(
      "[session-store] SESSION_STORE=kv requested but no KV impl is wired yet; falling back to in-memory. On Vercel this requires max-instances=1.",
    );
  }
  store = new InMemoryStore();
  return store;
}

export function newSessionId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}

export function makeRoomName(id: string): string {
  return `wingbuddy-${id.slice(0, 12)}`;
}

export function seedSession(partial: Partial<Session> & { sessionId: string; roomName: string; requesterKey: string; shareCode: string }): Session {
  return {
    createdAt: Date.now(),
    language: "hi",
    flight: seededFlight(),
    ssr: "none",
    presence: { requester: false, joiner: false },
    seq: 0,
    events: [],
    ...partial,
  };
}
