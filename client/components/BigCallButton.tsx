"use client";

import { useState } from "react";

export interface BigCallButtonProps {
  state?: "idle" | "connecting" | "connected";
  onTap?: () => void;
  onEnd?: () => void;
}

/**
 * Requester's huge pulsing "Tap to Get Help" CTA (PLAN-v2 §6 / v1 §5.2).
 * State 1 (idle) only in this stub; connecting/connected wired in Hour 2.
 */
export default function BigCallButton({
  state = "idle",
  onTap,
  onEnd,
}: BigCallButtonProps) {
  const [pressed, setPressed] = useState(false);

  if (state === "connected") {
    return (
      <button
        type="button"
        onClick={onEnd}
        className="mt-8 inline-flex h-16 w-full max-w-sm items-center justify-center rounded-full bg-danger px-8 text-lg font-semibold text-white shadow-card transition-transform duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
      >
        End Call
      </button>
    );
  }

  if (state === "connecting") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-8 flex h-44 w-44 flex-col items-center justify-center gap-3 rounded-full bg-accent/90 text-center text-base font-semibold text-white shadow-card"
      >
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
        />
        Connecting…
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onTap}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      aria-label="Tap to get help"
      className={`wb-pulse-ring relative mt-8 inline-flex h-44 w-44 items-center justify-center rounded-full bg-accent text-xl font-semibold text-white shadow-card outline-none transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:ring-4 focus-visible:ring-accent/40 ${
        pressed ? "scale-95" : "scale-100"
      }`}
    >
      Tap to Get Help
    </button>
  );
}
