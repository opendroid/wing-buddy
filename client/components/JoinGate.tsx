"use client";

import { useState } from "react";

export interface JoinGateProps {
  onSubmit?: (code: string, pin?: string) => void;
  error?: string;
}

/**
 * Manual code + PIN fallback form (PLAN-v2 §6 / v1 §5.3).
 * 6-char code (auto-uppercase) + 4-digit PIN. Enter-to-submit, soft shake on failure.
 */
export default function JoinGate({ onSubmit, error }: JoinGateProps) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [fail, setFail] = useState(false);

  function submit() {
    if (code.trim().length < 4) {
      setFail(true);
      return;
    }
    setFail(false);
    onSubmit?.(code.trim().toUpperCase(), pin || undefined);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={`flex flex-col gap-4 rounded-xl bg-card p-8 shadow-card ${
        fail ? "animate-[wb-badge-flip_0.4s_ease]" : ""
      }`}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-sm font-medium text-text">
          Code
        </label>
        <input
          id="code"
          inputMode="text"
          autoFocus
          autoCapitalize="characters"
          placeholder="ABCD12"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="h-12 rounded-lg border border-black/10 bg-bg px-4 text-lg tracking-widest text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pin" className="text-sm font-medium text-text">
          PIN <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="pin"
          inputMode="numeric"
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="h-12 rounded-lg border border-black/10 bg-bg px-4 text-lg tracking-widest text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-base font-medium text-white shadow-card transition-transform duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
      >
        Join the call
      </button>
    </form>
  );
}
