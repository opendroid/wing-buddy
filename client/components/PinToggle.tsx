"use client";

import { useState } from "react";

export interface PinToggleProps {
  enabled?: boolean;
  onChange?: (enabled: boolean) => void;
}

export default function PinToggle({ enabled = false, onChange }: PinToggleProps) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text">Add a PIN for extra privacy</span>
        <span className="text-xs text-text-muted">Optional — off by default.</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`PIN privacy ${on ? "on" : "off"}`}
        onClick={() => {
          const next = !on;
          setOn(next);
          onChange?.(next);
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full outline-none transition-colors duration-150 ease-standard focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          on ? "bg-success" : "bg-text-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform duration-150 ease-standard ${
            on ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
