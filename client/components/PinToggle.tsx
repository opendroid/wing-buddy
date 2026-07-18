"use client";

import { useState } from "react";

export interface PinToggleProps {
  enabled?: boolean;
  onChange?: (enabled: boolean) => void;
}

/**
 * Opt-in PIN toggle, OFF by default (PLAN-v2 §6 / v1 §5.2). Never blocks during distress.
 */
export default function PinToggle({ enabled = false, onChange }: PinToggleProps) {
  const [on, setOn] = useState(enabled);
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg bg-card p-4 shadow-card">
      <span className="flex flex-col">
        <span className="text-sm font-medium text-text">Add a PIN for extra privacy</span>
        <span className="text-xs text-text-muted">Optional — off by default.</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Add a PIN for extra privacy"
        onClick={() => {
          const next = !on;
          setOn(next);
          onChange?.(next);
        }}
        className={`relative h-7 w-12 rounded-full transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          on ? "bg-success" : "bg-text-muted"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
