import Link from "next/link";

function PrimaryCta() {
  return (
    <Link
      href="/help"
      className="inline-flex h-16 w-full max-w-md items-center justify-center rounded-full bg-accent px-10 text-xl font-semibold text-white shadow-card outline-none transition-[transform,box-shadow] duration-250 ease-standard hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-[0.98]"
    >
      Get help now
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col items-center justify-center gap-12 px-6 py-16">
      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-hero font-semibold tracking-tight text-text">
          WingBuddy
        </h1>
        <p className="max-w-md text-lg leading-7 text-text-muted">
          Help at the airport, in any language. A calm AI advocate speaks Hindi
          with the airline for you — and your family can follow along.
        </p>
        <p className="text-sm leading-5 text-text-muted">
          This is an AI assistant. Family can follow along when you text them
          the invite — no codes to read aloud.
        </p>
      </header>

      <section aria-label="Get help" className="flex w-full flex-col items-center gap-4">
        <PrimaryCta />
        <Link
          href="/join"
          className="text-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Join as a family member
        </Link>
      </section>
    </main>
  );
}
