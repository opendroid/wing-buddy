export interface JoinedBannerProps {
  visible: boolean;
  name?: string;
}

/**
 * Gentle "someone joined" banner — reassurance, not alarm (PLAN-v2 §6 / v1 §5.2).
 */
export default function JoinedBanner({ visible, name }: JoinedBannerProps) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success"
    >
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-success" />
      {name ? `${name} joined the call` : "Someone joined the call"}
    </div>
  );
}
