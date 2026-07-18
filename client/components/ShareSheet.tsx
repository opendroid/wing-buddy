"use client";

import { useState } from "react";

export interface ShareSheetProps {
  url?: string;
  onShared?: () => void;
}

export default function ShareSheet({ url, onShared }: ShareSheetProps) {
  const [feedback, setFeedback] = useState<"shared" | "copied" | null>(null);

  async function handleShare() {
    const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "WingBuddy — join my call", url: shareUrl });
        setFeedback("shared");
        onShared?.();
        return;
      } catch {
        /* user cancelled — do nothing */
        return;
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback("copied");
      onShared?.();
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-medium text-white shadow-card outline-none transition-[transform,box-shadow] duration-150 ease-standard focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-[0.98]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share link with family
      </button>
      {feedback === "copied" && (
        <p role="status" className="text-xs text-text-muted">Link copied to clipboard</p>
      )}
      {feedback === "shared" && (
        <p role="status" className="text-xs text-text-muted">Link shared</p>
      )}
    </div>
  );
}
