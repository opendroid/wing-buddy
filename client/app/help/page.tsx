import BigCallButton from "@/components/BigCallButton";
import PinToggle from "@/components/PinToggle";

export default function HelpPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="text-center">
        <h1 className="text-xxl font-semibold tracking-tight text-text">
          You&rsquo;re not alone
        </h1>
        <p className="mt-2 text-base text-text-muted">
          Tap below and an AI advocate will talk to the airline for you — in Hindi.
        </p>
      </header>

      <BigCallButton state="idle" />

      <div className="w-full max-w-sm">
        <PinToggle />
      </div>

      <p className="text-center text-sm text-text-muted">
        Your family can see this conversation if you share a link.
      </p>
    </main>
  );
}
