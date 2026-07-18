import JoinClient from "./JoinClient";

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-16">
      <header className="text-center">
        <h1 className="text-xxl font-semibold tracking-tight text-text">Join a call</h1>
        <p className="mt-2 text-base leading-6 text-text-muted">
          Enter the code the traveler shared with you to follow their status and send them a message.
        </p>
      </header>

      <JoinClient />
    </main>
  );
}
