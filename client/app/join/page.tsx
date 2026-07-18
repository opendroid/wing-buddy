import JoinClient from "./JoinClient";

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="text-center">
        <h1 className="text-xxl font-semibold tracking-tight text-text">Join a call</h1>
        <p className="mt-2 text-base text-text-muted">
          Enter the code shared with you to follow along and speak when needed.
        </p>
      </header>

      <JoinClient />
    </main>
  );
}
