// WingBuddy font stack — Apple HIG system fonts with web-safe fallback.
// Tailwind v4 maps --font-sans to this via @theme in app/globals.css.

export const fontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const fontMono =
  'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace';

// Tailwind type scale mirrors design.type in lib/design/tokens.ts so the two
// stay in lockstep. Add new steps here and in tokens.ts together.
export const typeScale = {
  xs: { fontSize: "12px", lineHeight: "16px" },
  sm: { fontSize: "14px", lineHeight: "20px" },
  base: { fontSize: "16px", lineHeight: "24px" },
  lg: { fontSize: "20px", lineHeight: "28px" },
  xl: { fontSize: "24px", lineHeight: "32px" },
  xxl: { fontSize: "32px", lineHeight: "40px" },
  hero: { fontSize: "48px", lineHeight: "56px" },
} as const;
