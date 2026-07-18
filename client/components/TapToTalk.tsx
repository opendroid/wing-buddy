export interface TapToTalkProps {
  onTranscript?: (text: string) => void;
}

/**
 * Press-and-hold fallback mic when auto-grant fails (PLAN-v2 §6 / v1 §5.2).
 * Stub: holds state only; real capture wired in Hour 2.
 */
export default function TapToTalk({ onTranscript }: TapToTalkProps) {
  return (
    <button
      type="button"
      aria-label="Press and hold to talk"
      className="inline-flex h-16 w-full max-w-sm items-center justify-center rounded-full bg-accent/90 px-8 text-base font-medium text-white shadow-card transition-transform duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
      // onPointerDown -> start capture; onPointerUp -> stop + onTranscript(text)
      onClick={() => onTranscript?.("")}
    >
      Press and hold to talk
    </button>
  );
}
