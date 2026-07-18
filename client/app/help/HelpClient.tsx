"use client";

import { useState, useRef } from "react";
import { VocalBridge, ConnectionState } from "@vocalbridgeai/sdk";
import BigCallButton from "@/components/BigCallButton";
import PinToggle from "@/components/PinToggle";
import ShareSheet from "@/components/ShareSheet";
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

function randomPin(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export default function HelpClient() {
  const [state, setState] = useState<CallState>("idle");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pin, setPin] = useState<string | undefined>();
  const [session, setSession] = useState<CreatedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vbRef = useRef<VocalBridge | null>(null);
  const lastAgentLineRef = useRef<string>("");

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
    try {
      await forwardTranscript({
        sessionId: created.sessionId,
        requesterKey: created.requesterKey,
        role,
        lang: "hi",
        text: trimmed,
      });
    } catch {
      /* transient — next line still worth sending */
    }
  }

  async function onTap() {
    if (state !== "idle") return;
    setError(null);
    setVoiceWarning(null);
    setState("requesting-mic");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setError(
        "Microphone access is needed to talk with the advocate. Please allow microphone access and try again."
      );
      setState("idle");
      return;
    }

    setState("connecting");
    const nextPin = pinEnabled ? randomPin() : undefined;

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPin ? { pin: nextPin } : {}),
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
      setPin(nextPin);

      // Release the permission probe so LiveKit can own the mic.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      await connectVoice(created);
      setState("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      await teardownVoice();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setSession(null);
      setPin(undefined);
      setState("idle");
    }
  }

  async function connectVoice(created: CreatedSession) {
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
        // Log brain reply for the joiner even if VB never emits a TTS transcript.
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
    } catch (e) {
      vbRef.current = null;
      try {
        await vb.disconnect();
      } catch {
        /* ignore */
      }
      // Session + share still work; joiner just won't see live speech lines
      // until voice is up. Surface a non-fatal warning.
      setVoiceWarning(
        e instanceof Error
          ? e.message
          : "Voice could not connect — share still works, transcript needs voice."
      );
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
    setPin(undefined);
    setVoiceWarning(null);
    setState("idle");
  }

  const shareUrl =
    session && typeof window !== "undefined"
      ? `${window.location.origin}/room/${session.sessionId}?t=${encodeURIComponent(session.t)}`
      : undefined;

  return (
    <>
      <BigCallButton state={state} onTap={onTap} onEnd={onEnd} />

      {state === "idle" && (
        <div className="w-full max-w-sm rounded-lg bg-card p-4 shadow-card">
          <PinToggle enabled={pinEnabled} onChange={setPinEnabled} />
        </div>
      )}

      {state === "connected" && session && (
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <p className="text-center text-sm text-text-muted">
            Share this link so your family can follow along.
          </p>
          {session.shareCode && (
            <p className="text-center text-sm text-text">
              Code:{" "}
              <span className="font-semibold tracking-wider">
                {session.shareCode}
              </span>
              {pin ? (
                <>
                  {" "}
                  · PIN:{" "}
                  <span className="font-semibold tracking-wider">{pin}</span>
                </>
              ) : null}
            </p>
          )}
          <ShareSheet url={shareUrl} />
          {voiceWarning && (
            <p role="status" className="text-center text-xs text-warning">
              {voiceWarning}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="max-w-sm text-center text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
