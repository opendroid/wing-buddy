export interface StatusCardProps {
  icon?: string;
  title: string;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  pulsing?: boolean;
}

const toneClasses: Record<NonNullable<StatusCardProps["tone"]>, string> = {
  neutral: "text-text-muted",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * Live sub-state card (PLAN-v2 §6, v1 §5.2). Pulsing dots, never alarming.
 * Used for flight status, wheelchair/SSR, airline call progress.
 */
export default function StatusCard({
  icon,
  title,
  detail,
  tone = "neutral",
  pulsing = false,
}: StatusCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-card">
      {icon && <span aria-hidden className="text-xl">{icon}</span>}
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${toneClasses[tone]}`}>{title}</span>
        {detail && <span className="text-xs text-text-muted">{detail}</span>}
      </div>
      {pulsing && (
        <span
          aria-hidden
          className="wb-pulse ml-auto h-2.5 w-2.5 rounded-full bg-accent"
        />
      )}
    </div>
  );
}
