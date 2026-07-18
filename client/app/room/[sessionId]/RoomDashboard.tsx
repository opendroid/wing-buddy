"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Transcript, { type TranscriptLine } from "@/components/Transcript";
import StatusCard from "@/components/StatusCard";
import AgentActionLog from "@/components/AgentActionLog";
import FacilitiesCard from "@/components/FacilitiesCard";
import DemoOverride from "@/components/DemoOverride";
import RelayMessage from "@/components/RelayMessage";

interface Flight {
  carrier: string;
  number: string;
  date: string;
  origin: string;
  dest: string;
  status: string;
  gate: string;
  delayMin: number;
  schedDep: string;
}

interface SessionState {
  sessionId: string;
  flight: Flight;
  ssr: string;
  presence: { requester: boolean; joiner: boolean };
  seq: number;
}

type PollEvent = {
  type: string;
  seq: number;
  role?: string;
  lang?: string;
  text?: string;
  textTranslated?: string;
  label?: string;
  value?: string;
  gate?: string;
  delayMin?: number;
  who?: string;
  kind?: string;
};

function flightDetail(f: Flight): string {
  const delay = f.delayMin > 0 ? ` · delayed ${f.delayMin}m` : "";
  return `${f.carrier} ${f.number} · ${f.origin}→${f.dest} · Gate ${f.gate}${delay}`;
}

function ssrLabel(ssr: string): {
  title: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
} {
  switch (ssr) {
    case "confirmed":
    case "reconfirmed":
      return {
        title: "Wheelchair confirmed",
        detail: "Assistance on file",
        tone: "success",
      };
    case "dropped":
      return {
        title: "Wheelchair dropped",
        detail: "Re-checking with airline…",
        tone: "warning",
      };
    default:
      return {
        title: "Wheelchair / assistance",
        detail: "Not requested yet",
        tone: "neutral",
      };
  }
}

function applyEvents(
  events: PollEvent[],
  setLines: Dispatch<SetStateAction<TranscriptLine[]>>,
  setActions: Dispatch<SetStateAction<string[]>>,
  setState: Dispatch<SetStateAction<SessionState | null>>,
  seenSeq: Set<number>
) {
  for (const ev of events) {
    if (seenSeq.has(ev.seq)) continue;
    seenSeq.add(ev.seq);

    if (ev.type === "transcript" && ev.text && ev.role) {
      setLines((prev) => [
        ...prev,
        {
          seq: ev.seq,
          role: ev.role as TranscriptLine["role"],
          lang: (ev.lang as "hi" | "en") ?? "en",
          text: ev.text!,
          textTranslated: ev.textTranslated,
        },
      ]);
    }
    // Relayed family text also appears in the live log (joiner's own words).
    if (ev.type === "family_message" && ev.text) {
      setLines((prev) => [
        ...prev,
        {
          seq: ev.seq,
          role: "joiner",
          lang: "en",
          text: ev.text!,
        },
      ]);
    }
    if (ev.type === "agent_action" && ev.label) {
      setActions((prev) => [...prev, ev.label!]);
    }
    if (ev.type === "ssr_update" && ev.value) {
      setState((prev) => (prev ? { ...prev, ssr: ev.value! } : prev));
    }
    if (ev.type === "flight_event" || ev.type === "flight_update") {
      setState((prev) => {
        if (!prev) return prev;
        const flight = { ...prev.flight };
        if (ev.gate) flight.gate = ev.gate;
        if (typeof ev.delayMin === "number") {
          flight.delayMin = ev.delayMin;
          if (ev.delayMin > 0) flight.status = "delayed";
        }
        return { ...prev, flight };
      });
    }
    if (ev.type === "presence") {
      setState((prev) => {
        if (!prev) return prev;
        const presence = { ...prev.presence };
        if (ev.who === "requester") {
          presence.requester = ev.kind === "joined";
        }
        if (ev.who === "joiner") {
          presence.joiner = ev.kind === "joined";
        }
        return { ...prev, presence };
      });
    }
  }
}

export default function RoomDashboard({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tParam = searchParams.get("t") ?? "";

  const [token, setToken] = useState(tParam);
  const [state, setState] = useState<SessionState | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const bootstrappedRef = useRef(false);

  // Late-joiner replay: always poll from seq 0 so prior transcript lines appear.
  const sinceRef = useRef(0);
  const seenSeqRef = useRef(new Set<number>());

  // Refresh / verify access via /api/join so mid-call links get a fresh TTL.
  useEffect(() => {
    if (!tParam) {
      setError("Missing access link. Open the message they texted you, or join with a code.");
      return;
    }
    // Avoid re-join loop when router.replace updates `t` in the URL.
    if (bootstrappedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: tParam }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          t?: string;
          sessionId?: string;
        };
        if (!res.ok || !data.t) {
          throw new Error(
            data.error === "invalid or expired token"
              ? "This link expired. Ask them to text you again, or join with the session code."
              : data.error || `Could not join (${res.status})`
          );
        }
        if (cancelled) return;
        bootstrappedRef.current = true;
        setToken(data.t);
        setReady(true);
        setError(null);
        if (data.t !== tParam) {
          const demo = searchParams.get("demo") === "1" ? "&demo=1" : "";
          router.replace(
            `/room/${sessionId}?t=${encodeURIComponent(data.t)}${demo}`
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not join session");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, tParam, router, searchParams]);

  // Initial hydrate from /state
  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/session/${sessionId}/state?t=${encodeURIComponent(token)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error || `Could not load session (${res.status})`
          );
        }
        if (!cancelled) {
          setState(data as SessionState);
          // Keep sinceRef at 0 — events poll replays the full log.
          sinceRef.current = 0;
          seenSeqRef.current = new Set();
          setLines([]);
          setActions([]);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load session");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, token, ready]);

  // Poll event log every 1.5s (and once immediately after hydrate)
  useEffect(() => {
    if (!ready || !token || error || !state) return;

    async function poll() {
      try {
        const res = await fetch(
          `/api/session/${sessionId}/events?since=${sinceRef.current}&t=${encodeURIComponent(token)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          events?: PollEvent[];
          seq?: number;
        };
        const events = data.events ?? [];
        if (events.length === 0) return;

        sinceRef.current = data.seq ?? events[events.length - 1]!.seq;
        applyEvents(events, setLines, setActions, setState, seenSeqRef.current);
      } catch {
        /* ignore transient poll errors */
      }
    }

    void poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [sessionId, token, error, state, ready]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-text">Can’t open this session</h1>
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
        <a href="/join" className="text-sm font-medium text-accent underline">
          Join with a code instead
        </a>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-6 py-16">
        <p className="text-text-muted">Joining live session…</p>
      </main>
    );
  }

  const ssr = ssrLabel(state.ssr);
  const flightTone =
    state.flight.status === "delayed" || state.flight.delayMin > 0
      ? "warning"
      : "success";

  const isDemo = searchParams.get("demo") === "1";
  const travelerLive = state.presence.requester;

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-success">
            {travelerLive ? "Following live" : "Waiting for traveler"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-text">
            {state.flight.carrier} {state.flight.number} &middot;{" "}
            {state.flight.origin}&rarr;{state.flight.dest}
          </h1>
          <p className="text-sm text-text-muted">
            {state.flight.date} &middot; Gate {state.flight.gate}
          </p>
          <p className="mt-1 max-w-md text-sm leading-5 text-text-muted">
            You’re following the conversation in real time — including what
            happened before you joined. Send a message below; the advocate will
            relay it in Hindi.
          </p>
        </div>
        {isDemo && <DemoOverride />}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <section
          aria-label="Live transcript"
          className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-card"
        >
          <Transcript lines={lines} dense showTranslation />
        </section>

        <aside className="flex flex-col gap-3">
          <StatusCard
            title={
              travelerLive
                ? "Traveler is connected"
                : "Waiting for traveler"
            }
            tone={travelerLive ? "success" : "neutral"}
          />
          <StatusCard
            title={`Flight ${state.flight.status.replace("_", " ")}`}
            detail={flightDetail(state.flight)}
            tone={flightTone}
          />
          <StatusCard
            title={ssr.title}
            detail={ssr.detail}
            tone={ssr.tone}
          />
          <FacilitiesCard airport={state.flight.origin} />
          <AgentActionLog actions={actions} />
        </aside>
      </div>

      <div className="flex justify-center">
        <RelayMessage token={token} />
      </div>

      {isDemo && (
        <p className="text-center text-xs text-text-muted">
          Tip: press <kbd className="rounded bg-bg px-1.5 py-0.5">d</kbd> to
          simulate a disruption (presenter only).
        </p>
      )}
    </main>
  );
}
