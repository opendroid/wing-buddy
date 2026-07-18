import JoinClient from "./JoinClient";

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-16">
      <header className="text-center">
        <h1 className="text-xxl font-semibold tracking-tight text-text">
          Follow a live session
        </h1>
        <p className="mt-2 text-base leading-6 text-text-muted">
          Prefer the link they texted you — it opens the live view right away,
          even mid-call. If you only have a code, enter it below.
        </p>
      </header>

      <JoinClient />
    </main>
  );
}
