export interface AgentActionLogProps {
  actions: string[];
}

/**
 * Scrollable log of agent actions (PLAN-v2 §6). e.g. "Checked booking ABC123".
 */
export default function AgentActionLog({ actions }: AgentActionLogProps) {
  return (
    <section
      aria-label="Agent action log"
      className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg bg-card p-4 shadow-card"
    >
      {actions.length === 0 && (
        <p className="text-sm text-text-muted">No actions yet.</p>
      )}
      {actions.map((a, i) => (
        <p key={i} className="text-sm leading-5 text-text">
          <span aria-hidden className="mr-2 text-accent">•</span>
          {a}
        </p>
      ))}
    </section>
  );
}
