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
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
          <span className="text-3xl text-success">&#10003;</span>
        </div>
        <p className="text-base font-medium text-text">You&rsquo;re connected</p>
        <button
          type="button"
          onClick={onEnd}
          className="inline-flex h-12 items-center justify-center rounded-full bg-text-muted/20 px-6 text-sm font-medium text-text-muted transition-colors duration-150 ease-standard hover:bg-danger/10 hover:text-danger"
        >
          End session
        </button>
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
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
          <span
            aria-hidden
            className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
          />
        </div>
        <p className="text-base text-text-muted">Connecting to advocate…</p>
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
      className={`relative mt-4 inline-flex h-16 w-full max-w-sm items-center justify-center rounded-full bg-accent px-8 text-lg font-semibold text-white shadow-card outline-none transition-[transform,box-shadow] duration-250 ease-spring focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-[0.98] ${
        pressed ? "scale-[0.98]" : ""
      }`}
    >
      Get help now
    </button>
  );
}
