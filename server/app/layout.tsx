// Required root layout. This is an API-only service (all routes live under
// app/api/**), but Next.js App Router still mandates a root layout to render
// the <html>/<body> shell — the build fails without it. No styling by design.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WingBuddy Server",
  description: "WingBuddy backend — sessions, VB tokens, brain, event log.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
