export interface JoinCallButtonProps {
  state?: "observing" | "prompted" | "in-call";
  onJoin?: () => void;
  onLeave?: () => void;
}

/**
 * Joiner's Observe -> "Join Call" (cyan pulse when agent requests human decision) -> 3-way (PLAN-v2 §6 / v1 §5.4).
 */
export default function JoinCallButton({
  state = "observing",
  onJoin,
  onLeave,
}: JoinCallButtonProps) {
  if (state === "in-call") {
    return (
      <button
        type="button"
        onClick={onLeave}
        className="inline-flex h-14 w-full max-w-sm items-center justify-center rounded-full bg-danger px-8 text-lg font-semibold text-white shadow-card transition-transform duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-95"
      >
        Leave Call
      </button>
    );
  }

  const prompted = state === "prompted";
  return (
    <button
      type="button"
      onClick={onJoin}
      className={`relative inline-flex h-14 w-full max-w-sm items-center justify-center rounded-full px-8 text-lg font-semibold text-white shadow-card outline-none transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:ring-4 active:scale-95 ${
        prompted ? "wb-pulse bg-accent" : "bg-text-muted"
      }`}
    >
      {prompted ? "Speak now" : "Join Call"}
    </button>
  );
}
