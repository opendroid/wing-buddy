"use client";

import { useEffect, useRef, useState } from "react";

export interface ShareSheetProps {
  url?: string;
  /** Attempt native share once (must still be in a user-gesture chain). */
  autoOpen?: boolean;
  onShared?: () => void;
}

const SHARE_TITLE = "WingBuddy";
const SHARE_TEXT =
  "I'm at the airport — my advocate is helping me. You can follow along here:";

export default function ShareSheet({
  url,
  autoOpen = false,
  onShared,
}: ShareSheetProps) {
  const [feedback, setFeedback] = useState<"shared" | "copied" | null>(null);
  const triedAuto = useRef(false);

  async function handleShare() {
    const shareUrl =
      url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!shareUrl) return;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: SHARE_TITLE,
          text: SHARE_TEXT,
          url: shareUrl,
        });
        setFeedback("shared");
        onShared?.();
        return;
      } catch {
        /* cancelled — leave soft button available */
        return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${SHARE_TEXT} ${shareUrl}`);
        setFeedback("copied");
        onShared?.();
      } catch {
        /* ignore */
      }
    }
  }

  useEffect(() => {
    if (!autoOpen || !url || triedAuto.current) return;
    triedAuto.current = true;
    void handleShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on connect
  }, [autoOpen, url]);

  if (feedback === "shared" || feedback === "copied") {
    return (
      <p
        role="status"
        className="text-center text-sm text-success transition-opacity duration-250 ease-standard"
      >
        {feedback === "shared"
          ? "Family can follow along now"
          : "Message copied — paste it to family"}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="group inline-flex h-14 w-full max-w-sm items-center justify-center gap-2.5 rounded-full bg-text px-7 text-base font-medium text-bg shadow-card outline-none transition-[transform,background-color,box-shadow] duration-250 ease-standard hover:bg-text/90 focus-visible:ring-4 focus-visible:ring-accent/30 active:scale-[0.98]"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="opacity-90 transition-transform duration-250 ease-spring group-hover:-translate-y-0.5"
      >
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22 11 13 2 9 22 2z" />
      </svg>
      Text family
    </button>
  );
}
