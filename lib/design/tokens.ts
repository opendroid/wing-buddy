// WingBuddy design tokens — Apple HIG (deference, clarity, depth, restraint).
// Single source of truth. Mirrored into app/globals.css @theme for Tailwind v4.

export const design = {
  spacing: {
    base: 8,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  motion: {
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    ease: "cubic-bezier(0.4, 0, 0.2, 1)",
    duration: {
      fast: 150,
      normal: 250,
      slow: 400,
    },
  },
  colors: {
    bg: "#FAFAFA",
    card: "#FFFFFF",
    text: "#1D1D1F",
    textMuted: "#86868B",
    accent: "#007AFF", // system blue
    success: "#34C759", // system green
    warning: "#FF9500", // system orange
    danger: "#FF3B30", // system red
    speaker: {
      requester: "#007AFF",
      joiner: "#34C759",
      agent: "#FF9500",
      airline: "#86868B",
    },
  },
  type: {
    xs: { fontSize: 12, lineHeight: 16 },
    sm: { fontSize: 14, lineHeight: 20 },
    base: { fontSize: 16, lineHeight: 24 },
    lg: { fontSize: 20, lineHeight: 28 },
    xl: { fontSize: 24, lineHeight: 32 },
    xxl: { fontSize: 32, lineHeight: 40 },
    hero: { fontSize: 48, lineHeight: 56 },
  },
  shadow: {
    card: "0 4px 24px rgba(0, 0, 0, 0.06)",
    cardHover: "0 8px 32px rgba(0, 0, 0, 0.10)",
  },
} as const;

// Per-speaker label colors (used by Transcript + StatusCard).
export const speakerColors = design.colors.speaker;

export type SpeakerRole = keyof typeof design.colors.speaker;

export function speakerColor(role: SpeakerRole): string {
  return design.colors.speaker[role];
}
