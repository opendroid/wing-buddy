"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
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
    if (ev.type === "presence" && ev.who === "requester") {
      setState((prev) =>
        prev
          ? {
              ...prev,
              presence: {
                ...prev.presence,
                requester: ev.kind === "joined",
              },
            }
          : prev
      );
    }
  }
}

export default function RoomDashboard({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const t = searchParams.get("t") ?? "";

  const [state, setState] = useState<SessionState | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Late-joiner replay: always poll from seq 0 so prior transcript lines appear.
  const sinceRef = useRef(0);
  const seenSeqRef = useRef(new Set<number>());

  // Initial hydrate from /state
  useEffect(() => {
    if (!t) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/session/${sessionId}/state?t=${encodeURIComponent(t)}`
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
  }, [sessionId, t]);

  // Poll event log every 1.5s (and once immediately after hydrate)
  useEffect(() => {
    if (!t || error || !state) return;

    async function poll() {
      try {
        const res = await fetch(
          `/api/session/${sessionId}/events?since=${sinceRef.current}&t=${encodeURIComponent(t)}`
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
  }, [sessionId, t, error, state]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-text">Can’t open this call</h1>
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
        <a href="/join" className="text-sm font-medium text-accent underline">
          Try joining with a code
        </a>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-6 py-16">
        <p className="text-text-muted">Loading session…</p>
      </main>
    );
  }

  const ssr = ssrLabel(state.ssr);
  const flightTone =
    state.flight.status === "delayed" || state.flight.delayMin > 0
      ? "warning"
      : "success";

  const isDemo = searchParams.get("demo") === "1";

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold tracking-tight text-text">
            {state.flight.carrier} {state.flight.number} &middot;{" "}
            {state.flight.origin}&rarr;{state.flight.dest}
          </h1>
          <p className="text-sm text-text-muted">
            {state.flight.date} &middot; Gate {state.flight.gate}
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
              state.presence.requester
                ? "Traveler is connected"
                : "Waiting for traveler"
            }
            tone={state.presence.requester ? "success" : "neutral"}
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
        <RelayMessage token={t} />
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
