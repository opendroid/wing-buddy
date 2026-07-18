"use client";

import { useState } from "react";
import BigCallButton from "@/components/BigCallButton";
import PinToggle from "@/components/PinToggle";
import ShareSheet from "@/components/ShareSheet";

type CallState = "idle" | "connecting" | "connected";

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

  async function onTap() {
    if (state !== "idle") return;
    setState("connecting");
    setError(null);

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
        /* private mode — voice token mint can still use in-memory below */
      }

      setSession({
        sessionId: data.sessionId,
        t: data.t,
        shareCode: data.shareCode ?? "",
        requesterKey: data.requesterKey,
      });
      setPin(nextPin);
      setState("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("idle");
    }
  }

  function onEnd() {
    setSession(null);
    setPin(undefined);
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
        <div className="w-full max-w-sm">
          <PinToggle enabled={pinEnabled} onChange={setPinEnabled} />
        </div>
      )}

      {state === "connected" && session && (
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <p className="text-center text-sm text-text-muted">
            Session ready. Share this link so family can follow along.
          </p>
          {session.shareCode && (
            <p className="text-center text-sm text-text">
              Share code:{" "}
              <span className="font-semibold tracking-wider">{session.shareCode}</span>
              {pin ? (
                <>
                  {" "}
                  · PIN: <span className="font-semibold tracking-wider">{pin}</span>
                </>
              ) : null}
            </p>
          )}
          <ShareSheet url={shareUrl} />
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
