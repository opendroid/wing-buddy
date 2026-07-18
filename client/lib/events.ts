// Event envelope for the append-only event log + 1.5s client poll (PLAN-v2 §4.3).
// The poll endpoint returns events with seq > since. ?demo=1 replays a scripted
// WBEvent[] through the SAME renderers as live events (no separate demo UI path).

export type SSRState = "none" | "confirmed" | "dropped" | "reconfirmed";

export type TranscriptRole = "traveler" | "agent" | "joiner";

export type WBEvent =
  | { seq: number; ts: number; type: "flight_event"; kind: "gate_change" | "delay"; gate?: string; delayMin?: number }
  | { seq: number; ts: number; type: "ssr_update"; value: SSRState }
  | { seq: number; ts: number; type: "agent_action"; label: string }
  | { seq: number; ts: number; type: "facilities"; airport: string; need: string; result: string }
  | { seq: number; ts: number; type: "family_message"; text: string }
  | {
      seq: number;
      ts: number;
      type: "flight_update";
      kind: string;
      gate?: string;
      delayMin?: number;
    }
  | { seq: number; ts: number; type: "presence"; who: "requester" | "joiner"; kind: "joined" | "left" }
  | {
      seq: number;
      ts: number;
      type: "transcript";
      role: TranscriptRole;
      lang: string;
      text: string;
      textTranslated?: string;
    };

export const EVENTS_CAP = 500;

/** Append a raw (seq-less) event, stamping seq + ts. Returns the stamped event. */
export function stampEvent<T extends Omit<WBEvent, "seq" | "ts">>(
  seq: number,
  partial: T,
): WBEvent {
  return { seq, ts: Date.now(), ...partial } as unknown as WBEvent;
}

/** Events with seq strictly greater than `since` (for the poll endpoint). */
export function eventsSince(events: WBEvent[], since: number): WBEvent[] {
  return events.filter((e) => e.seq > since);
}
