"use client";

import { useEffect, useRef, useState } from "react";
import { VocalBridge, ConnectionState } from "@vocalbridgeai/sdk";
import BigCallButton from "@/components/BigCallButton";
import ShareSheet from "@/components/ShareSheet";
import Transcript, { type TranscriptLine } from "@/components/Transcript";
import { forwardTranscript } from "@/lib/forward-transcript";

type CallState =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "connected"
  | "error";

interface CreatedSession {
  sessionId: string;
  t: string;
  shareCode: string;
  requesterKey: string;
}

export default function HelpClient() {
  const [state, setState] = useState<CallState>("idle");
  const [session, setSession] = useState<CreatedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [familyInvited, setFamilyInvited] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const vbRef = useRef<VocalBridge | null>(null);
  const lastAgentLineRef = useRef<string>("");
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  function appendLocalLine(role: "traveler" | "agent", text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLines((prev) => [
      ...prev,
      { role, lang: "hi", text: trimmed, at: Date.now() },
    ]);
  }

  async function postLine(
    created: CreatedSession,
    role: "traveler" | "agent",
    text: string
  ) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (role === "agent") {
      if (trimmed === lastAgentLineRef.current) return;
      lastAgentLineRef.current = trimmed;
    }
    appendLocalLine(role, trimmed);
    try {
      await forwardTranscript({
        sessionId: created.sessionId,
        requesterKey: created.requesterKey,
        role,
        lang: "hi",
        text: trimmed,
      });
    } catch (e) {
      console.error("[transcript]", e);
      setVoiceWarning(
        e instanceof Error ? e.message : "Could not sync transcript to family view"
      );
    }
  }

  async function onTap() {
    if (state !== "idle") return;
    setError(null);
    setVoiceWarning(null);
    setFamilyInvited(false);
    setLines([]);
    lastAgentLineRef.current = "";
    setState("requesting-mic");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setError(
        "Microphone access is needed so your advocate can hear you. Please allow it and try again."
      );
      setState("idle");
      return;
    }

    setState("connecting");

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessionId?: string;
        t?: string;
        shareCode?: string;
        requesterKey?: string;
      };
      if (!res.ok || !data.sessionId || !data.t || !data.requesterKey) {
        throw new Error(data.error || `Could not start session (${res.status})`);
      }

      try {
        sessionStorage.setItem(`wb:${data.sessionId}:key`, data.requesterKey);
      } catch {
        /* private mode */
      }

      const created: CreatedSession = {
        sessionId: data.sessionId,
        t: data.t,
        shareCode: data.shareCode ?? "",
        requesterKey: data.requesterKey,
      };
      setSession(created);

      // Release the permission probe so LiveKit can own the mic.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const voiceOk = await connectVoice(created);
      setState("connected");
      if (!voiceOk) {
        console.error("[voice] connected session without live agent");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      await teardownVoice();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setSession(null);
      setState("idle");
    }
  }

  async function connectVoice(created: CreatedSession): Promise<boolean> {
    const vb = new VocalBridge({
      auth: {
        tokenProvider: async () => {
          const res = await fetch(
            `/api/voice-token?sessionId=${encodeURIComponent(created.sessionId)}&role=requester`,
            { headers: { "x-wb-key": created.requesterKey } }
          );
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            detail?: string;
            token?: string;
            url?: string;
            livekit_url?: string;
            room_name?: string;
            roomName?: string;
            participant_identity?: string;
            expires_in?: number;
            agent_mode?: string;
          };
          if (!res.ok || !body.token) {
            throw new Error(
              body.detail || body.error || `voice token failed (${res.status})`
            );
          }
          const url = body.url ?? body.livekit_url;
          if (!url) {
            throw new Error("voice token missing LiveKit url");
          }
          return {
            token: body.token,
            url,
            room_name: body.room_name ?? body.roomName ?? "",
            participant_identity: body.participant_identity ?? "requester",
            expires_in: body.expires_in ?? 3600,
            agent_mode: body.agent_mode,
          };
        },
      },
      participantName: "requester",
      sessionId: created.sessionId,
    });

    vb.on("transcript", (entry) => {
      const role = entry.role === "agent" ? "agent" : "traveler";
      void postLine(created, role, entry.text);
    });

    vb.onAIAgentQuery(async (query) => {
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wb-key": created.requesterKey,
          },
          body: JSON.stringify({
            sessionId: created.sessionId,
            query,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          answer?: string;
        };
        const answer =
          body.answer?.trim() ||
          "मैं अभी जाँच कर रही हूँ। आप ठीक हैं।";
        void postLine(created, "agent", answer);
        return answer;
      } catch {
        return "मैं अभी जाँच कर रही हूँ। आप ठीक हैं।";
      }
    });

    vb.on("connectionStateChanged", (s) => {
      if (s === ConnectionState.Connected || s === ConnectionState.WaitingForAgent) {
        setVoiceWarning(null);
      }
    });

    vb.on("error", (err) => {
      setVoiceWarning(err.message || "Voice connection issue");
    });

    try {
      await vb.connect();
      vbRef.current = vb;
      return true;
    } catch (e) {
      vbRef.current = null;
      try {
        await vb.disconnect();
      } catch {
        /* ignore */
      }
      setVoiceWarning(
        e instanceof Error
          ? e.message
          : "Voice could not connect — you can still text family to follow along."
      );
      return false;
    }
  }

  async function teardownVoice() {
    const vb = vbRef.current;
    vbRef.current = null;
    if (!vb) return;
    try {
      await vb.disconnect();
    } catch {
      /* ignore */
    }
  }

  async function onEnd() {
    await teardownVoice();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setSession(null);
    setVoiceWarning(null);
    setFamilyInvited(false);
    setLines([]);
    lastAgentLineRef.current = "";
    setState("idle");
  }

  const shareUrl =
    session && typeof window !== "undefined"
      ? `${window.location.origin}/room/${session.sessionId}?t=${encodeURIComponent(session.t)}`
      : undefined;

  const idle = state === "idle";
  const live = state === "connected" && session;

  return (
    <div
      className={`flex w-full max-w-sm flex-col items-center transition-[gap] duration-400 ease-standard ${
        live ? "gap-8" : "gap-6"
      }`}
    >
      {idle && (
        <header className="text-center">
          <h1 className="text-xxl font-semibold tracking-tight text-text">
            You&rsquo;re not alone
          </h1>
          <p className="mt-2 text-base leading-6 text-text-muted">
            One tap. An advocate speaks Hindi with the airline for you.
            When you&rsquo;re ready, text family so they can follow along —
            no codes to remember.
          </p>
        </header>
      )}

      {live && (
        <p className="sr-only" role="status" aria-live="polite">
          Connected to your advocate
        </p>
      )}

      <BigCallButton state={state} onTap={onTap} onEnd={onEnd} />

      {live && (
        <section
          aria-label="Live conversation"
          className="flex w-full max-h-64 flex-col gap-2 overflow-y-auto overscroll-contain rounded-xl px-1"
        >
          <p className="text-center text-xs font-medium uppercase tracking-wide text-text-muted">
            Conversation
          </p>
          <Transcript lines={lines} dense />
          <div ref={transcriptEndRef} aria-hidden />
        </section>
      )}

      {live && shareUrl && (
        <div className="flex w-full flex-col items-center gap-3">
          {!familyInvited && (
            <p className="max-w-[18rem] text-center text-sm leading-5 text-text-muted">
              When you can, send one message so family can watch with you.
            </p>
          )}
          <ShareSheet
            url={shareUrl}
            autoOpen
            onShared={() => setFamilyInvited(true)}
          />
        </div>
      )}

      {voiceWarning && (
        <p role="status" className="max-w-sm text-center text-xs text-warning">
          {voiceWarning}
        </p>
      )}

      {error && (
        <p role="alert" className="max-w-sm text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
