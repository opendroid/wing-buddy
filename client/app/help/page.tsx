import HelpClient from "./HelpClient";

export default function HelpPage() {
  return (
    <main className="relative mx-auto flex min-h-[100svh] w-full max-w-lg flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Soft atmospheric wash — calm, not decorative noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 20%, rgba(0,122,255,0.07), transparent 60%), radial-gradient(ellipse 70% 45% at 50% 90%, rgba(52,199,89,0.06), transparent 55%)",
        }}
      />
      <HelpClient />
    </main>
  );
}
