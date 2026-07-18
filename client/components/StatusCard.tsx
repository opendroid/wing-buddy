export interface StatusCardProps {
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

const toneIndicators: Record<NonNullable<StatusCardProps["tone"]>, { dot: string; label: string }> = {
  neutral: { dot: "bg-text-muted", label: "neutral" },
  success: { dot: "bg-success", label: "confirmed" },
  warning: { dot: "bg-warning", label: "needs attention" },
  danger: { dot: "bg-danger", label: "issue" },
};

export default function StatusCard({
  title,
  detail,
  tone = "neutral",
  pulsing = false,
}: StatusCardProps) {
  const indicator = toneIndicators[tone];
  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-card"
      role="status"
      aria-label={`${title}${detail ? `: ${detail}` : ""} — ${indicator.label}`}
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${indicator.dot} ${pulsing ? "wb-pulse" : ""}`}
      />
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${toneClasses[tone]}`}>{title}</span>
        {detail && <span className="text-xs text-text-muted">{detail}</span>}
      </div>
    </div>
  );
}
