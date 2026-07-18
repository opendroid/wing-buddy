export interface DemoOverrideProps {
  active?: boolean;
  onToggle?: (active: boolean) => void;
}

/**
 * ?demo=1 scripted UI state manager (PLAN-v2 §6 / v1 §5.4).
 * Replays lib/demo-script.ts through the same renderers as live events.
 */
export default function DemoOverride({ active = false, onToggle }: DemoOverrideProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onToggle?.(!active)}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium shadow-card transition-colors ${
        active ? "bg-warning text-white" : "bg-card text-text-muted"
      }`}
    >
      <span aria-hidden>🎬</span>
      Demo mode {active ? "on" : "off"}
    </button>
  );
}
