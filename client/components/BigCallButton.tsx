"use client";

import { useState } from "react";

export interface BigCallButtonProps {
  state?: "idle" | "requesting-mic" | "connecting" | "connected" | "error";
  onTap?: () => void;
  onEnd?: () => void;
}

export default function BigCallButton({
  state = "idle",
  onTap,
  onEnd,
}: BigCallButtonProps) {
  const [pressed, setPressed] = useState(false);

  if (state === "connected") {
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-success/20 wb-pulse-ring"
            style={{ ["--color-accent" as string]: "var(--color-success)" }}
          />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-success/15 wb-pulse">
            <span className="h-3.5 w-3.5 rounded-full bg-success shadow-[0_0_0_6px_rgba(52,199,89,0.18)]" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold tracking-tight text-text">
            Advocate is with you
          </p>
          <p className="mt-1.5 max-w-[16rem] text-sm leading-5 text-text-muted">
            Speak naturally. Hindi is perfect. You&rsquo;re doing fine.
          </p>
        </div>
        {onEnd ? (
          <button
            type="button"
            onClick={onEnd}
            className="text-xs font-medium text-text-muted/80 underline-offset-2 transition-colors duration-150 hover:text-danger hover:underline"
          >
            End quietly
          </button>
        ) : null}
      </div>
    );
  }

  if (state === "requesting-mic") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
          <span
            aria-hidden
            className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
          />
        </div>
        <p className="text-base text-text-muted">Allow microphone access…</p>
      </div>
    );
  }

  if (state === "connecting") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4"
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-accent/15 wb-pulse-ring" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <span
              aria-hidden
              className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
            />
          </div>
        </div>
        <p className="text-base text-text-muted">Connecting to your advocate…</p>
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
      aria-label="Tap to get help from an AI advocate"
      className={`relative mt-2 inline-flex h-16 w-full max-w-sm items-center justify-center rounded-full bg-accent px-8 text-lg font-semibold text-white shadow-card outline-none transition-[transform,box-shadow] duration-250 ease-spring focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-[0.98] ${
        pressed ? "scale-[0.98]" : ""
      }`}
    >
      Get help now
    </button>
  );
}
