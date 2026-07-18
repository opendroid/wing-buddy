export interface ShareSheetProps {
  url?: string;
  onShared?: () => void;
}

/**
 * Native OS share sheet (navigator.share) with copy-link fallback (PLAN-v2 §6 / v1 §5.5).
 * Sends a signed link via WhatsApp/SMS.
 */
export default function ShareSheet({ url, onShared }: ShareSheetProps) {
  async function handleShare() {
    const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "WingBuddy — join my call", url: shareUrl });
        onShared?.();
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      onShared?.();
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-medium text-white shadow-card transition-transform duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
    >
      <span aria-hidden>📤</span>
      Share link
    </button>
  );
}
