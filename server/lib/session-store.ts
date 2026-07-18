import { randomUUID, randomBytes } from "node:crypto";
import {
  type FlightStatus,
  type SSRState,
  type WBEvent,
  type WBEventBody,
  MAX_EVENTS,
} from "./events";
import { mintRequesterKey } from "./access";

export interface Flight {
  carrier: string;
  number: string;
  date: string; // ISO date
  origin: string;
  dest: string;
  schedDep: string; // ISO datetime
  status: FlightStatus;
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

export interface CreateSeed {
  flight: Flight;
  pinHash?: string;
}

// Metadata persisted per session (everything except seq + events, which have
// their own atomic Redis structures).
type SessionMeta = Omit<Session, "seq" | "events">;

const TTL_SECONDS = 24 * 60 * 60; // sessions auto-expire after a day

function metaOf(s: Session): SessionMeta {
  const { seq: _seq, events: _events, ...meta } = s;
  return meta;
}

function shareCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function newSessionObject(seed: CreateSeed): Session {
  const sessionId = randomUUID();
  return {
    sessionId,
    roomName: `wingbuddy-${sessionId.slice(0, 8)}`,
    createdAt: Date.now(),
    requesterKey: mintRequesterKey(),
    shareCode: shareCode(),
    pinHash: seed.pinHash,
    language: "hi",
    flight: seed.flight,
    ssr: "none",
    presence: { requester: false, joiner: false },
    seq: 0,
    events: [],
  };
}

// ---------------------------------------------------------------------------
// Backend abstraction. Value semantics: getSession returns a snapshot; all
// persisted mutations go through appendEvent (atomic) or saveMeta.
// ---------------------------------------------------------------------------

interface StoreBackend {
  create(session: Session): Promise<void>;
  getMeta(id: string): Promise<SessionMeta | undefined>;
  getSeq(id: string): Promise<number>;
  getEvents(id: string): Promise<WBEvent[]>;
  idForShareCode(code: string): Promise<string | undefined>;
  saveMeta(meta: SessionMeta): Promise<void>;
  appendEvent(id: string, body: WBEventBody): Promise<WBEvent>;
  count(): Promise<number>;
  reset(): Promise<void>;
}

// In-memory backend — local dev + hermetic tests (no Redis needed).
class MemoryBackend implements StoreBackend {
  private meta = new Map<string, SessionMeta>();
  private seq = new Map<string, number>();
  private events = new Map<string, WBEvent[]>();
  private byCode = new Map<string, string>();

  async create(s: Session) {
    this.meta.set(s.sessionId, metaOf(s));
    this.seq.set(s.sessionId, 0);
    this.events.set(s.sessionId, []);
    this.byCode.set(s.shareCode, s.sessionId);
  }
  async getMeta(id: string) {
    const m = this.meta.get(id);
    return m ? structuredClone(m) : undefined;
  }
  async getSeq(id: string) {
    return this.seq.get(id) ?? 0;
  }
  async getEvents(id: string) {
    return structuredClone(this.events.get(id) ?? []);
  }
  async idForShareCode(code: string) {
    return this.byCode.get(code.trim().toUpperCase());
  }
  async saveMeta(m: SessionMeta) {
    this.meta.set(m.sessionId, structuredClone(m));
  }
  async appendEvent(id: string, body: WBEventBody) {
    const seq = (this.seq.get(id) ?? 0) + 1;
    this.seq.set(id, seq);
    const event: WBEvent = { ...body, seq, ts: Date.now() };
    const list = this.events.get(id) ?? [];
    list.push(event);
    if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
    this.events.set(id, list);
    return event;
  }
  async count() {
    return this.meta.size;
  }
  async reset() {
    this.meta.clear();
    this.seq.clear();
    this.events.clear();
    this.byCode.clear();
  }
}

// Upstash Redis backend — durable, safe on Vercel multi-instance serverless.
// Keys: wb:s:{id} meta | wb:seq:{id} counter | wb:ev:{id} list | wb:sc:{code} id
class RedisBackend implements StoreBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redis: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(redis: any) {
    this.redis = redis;
  }
  private k = {
    meta: (id: string) => `wb:s:${id}`,
    seq: (id: string) => `wb:seq:${id}`,
    ev: (id: string) => `wb:ev:${id}`,
    sc: (code: string) => `wb:sc:${code.trim().toUpperCase()}`,
    ids: "wb:ids",
  };

  async create(s: Session) {
    const id = s.sessionId;
    await Promise.all([
      this.redis.set(this.k.meta(id), metaOf(s), { ex: TTL_SECONDS }),
      this.redis.set(this.k.seq(id), 0, { ex: TTL_SECONDS }),
      this.redis.set(this.k.sc(s.shareCode), id, { ex: TTL_SECONDS }),
      this.redis.sadd(this.k.ids, id),
    ]);
  }
  async getMeta(id: string) {
    const m = await this.redis.get(this.k.meta(id));
    if (!m) return undefined;
    return (typeof m === "string" ? JSON.parse(m) : m) as SessionMeta;
  }
  async getSeq(id: string) {
    const n = await this.redis.get(this.k.seq(id));
    return Number(n ?? 0);
  }
  async getEvents(id: string) {
    const raw: unknown[] = (await this.redis.lrange(this.k.ev(id), 0, -1)) ?? [];
    return raw.map((e) => (typeof e === "string" ? JSON.parse(e) : e)) as WBEvent[];
  }
  async idForShareCode(code: string) {
    const id = await this.redis.get(this.k.sc(code));
    return id ? String(id) : undefined;
  }
  async saveMeta(m: SessionMeta) {
    await this.redis.set(this.k.meta(m.sessionId), m, { ex: TTL_SECONDS });
  }
  async appendEvent(id: string, body: WBEventBody) {
    const seq = Number(await this.redis.incr(this.k.seq(id)));
    const event: WBEvent = { ...body, seq, ts: Date.now() };
    await this.redis.rpush(this.k.ev(id), event);
    await this.redis.ltrim(this.k.ev(id), -MAX_EVENTS, -1);
    await this.redis.expire(this.k.ev(id), TTL_SECONDS);
    await this.redis.expire(this.k.seq(id), TTL_SECONDS);
    return event;
  }
  async count() {
    return Number((await this.redis.scard(this.k.ids)) ?? 0);
  }
  async reset() {
    // no-op in prod; tests use the memory backend
  }
}

let _backend: StoreBackend | null = null;
function backend(): StoreBackend {
  if (_backend) return _backend;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Lazy require so the dependency isn't pulled into the memory/test path.
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    _backend = new RedisBackend(Redis.fromEnv());
  } else {
    _backend = new MemoryBackend();
  }
  return _backend;
}

export function usingRedis(): boolean {
  return backend() instanceof RedisBackend;
}

// ---------------------------------------------------------------------------
// Public async store API. Callers must persist via appendEvent / mutateSession.
// ---------------------------------------------------------------------------

export async function createSession(seed: CreateSeed): Promise<Session> {
  const session = newSessionObject(seed);
  await backend().create(session);
  return session;
}

async function hydrate(id: string): Promise<Session | undefined> {
  const meta = await backend().getMeta(id);
  if (!meta) return undefined;
  const [seq, events] = await Promise.all([
    backend().getSeq(id),
    backend().getEvents(id),
  ]);
  return { ...meta, seq, events };
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  return hydrate(sessionId);
}

export async function getSessionByShareCode(
  code: string
): Promise<Session | undefined> {
  const id = await backend().idForShareCode(code);
  return id ? hydrate(id) : undefined;
}

// Append an event atomically; also updates the in-memory snapshot for the caller.
export async function appendEvent(
  session: Session,
  body: WBEventBody
): Promise<WBEvent> {
  const event = await backend().appendEvent(session.sessionId, body);
  session.seq = event.seq;
  session.events.push(event);
  if (session.events.length > MAX_EVENTS) {
    session.events.splice(0, session.events.length - MAX_EVENTS);
  }
  return event;
}

// Events strictly newer than `since` (monotonic seq).
export function eventsSince(session: Session, since: number): WBEvent[] {
  return session.events.filter((e) => e.seq > since);
}

// Mutate flight / ssr / presence, then persist the metadata.
export async function mutateSession(
  session: Session,
  fn: (s: Session) => void
): Promise<Session> {
  fn(session);
  await backend().saveMeta(metaOf(session));
  return session;
}

export async function sessionCount(): Promise<number> {
  return backend().count();
}

// Test-only: clear the in-memory store between cases.
export async function __resetStore(): Promise<void> {
  await backend().reset();
}
