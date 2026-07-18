"use client";

import { useState } from "react";

export interface RelayMessageProps {
  token: string;
}

export default function RelayMessage({ token }: RelayMessageProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSend() {
    const raw = text.trim();
    if (!raw || status === "sending") return;

    setStatus("sending");
    try {
      const res = await fetch(
        `/api/relay?t=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: raw }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send message");
      }
      setText("");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-muted" htmlFor="relay-input">
          Message the traveler (via advocate)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="relay-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="Type your message in English or Hindi…"
            disabled={status === "sending"}
            className="h-10 flex-1 rounded-lg border border-black/10 bg-bg px-3 text-sm text-text outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || status === "sending"}
            aria-label="Send message"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white outline-none transition-[transform,box-shadow] duration-150 ease-standard focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.95] disabled:opacity-40 disabled:active:scale-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        {status === "sent" && (
          <p role="status" className="text-xs text-success">Message sent &mdash; the advocate will relay it to the traveler.</p>
        )}
        {status === "error" && (
          <p role="alert" className="text-xs text-danger">Could not send. Try again.</p>
        )}
        <p className="text-xs text-text-muted">
          You&rsquo;re following along — not on the voice call. The AI advocate
          will relay your message to the traveler in Hindi.
        </p>
      </div>
    </div>
  );
}