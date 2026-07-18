import HelpClient from "./HelpClient";

export default function HelpPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col items-center justify-center gap-8 px-6 py-16">
      <header className="text-center">
        <h1 className="text-xxl font-semibold tracking-tight text-text">
          You&rsquo;re not alone
        </h1>
        <p className="mt-2 text-base leading-6 text-text-muted">
          Tap below and an AI advocate will talk to the airline for you — in Hindi.
          Your family can follow along and message you through the advocate.
        </p>
      </header>

      <HelpClient />
    </main>
  );
}
