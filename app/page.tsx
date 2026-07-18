import Link from "next/link";

interface ChoiceCardProps {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  cta: string;
  accent: string;
}

function ChoiceCard({ href, title, subtitle, icon, cta, accent }: ChoiceCardProps) {
  return (
    <Link
      href={href}
      aria-label={`${title}. ${subtitle}`}
      className="group relative flex w-full max-w-sm flex-col items-start gap-6 rounded-xl bg-card p-8 shadow-card outline-none transition-[transform,box-shadow] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
    >
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
        style={{ backgroundColor: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-xxl font-semibold tracking-tight text-text">{title}</h2>
        <p className="text-base leading-6 text-text-muted">{subtitle}</p>
      </div>
      <span
        className="mt-2 inline-flex items-center gap-1 text-base font-medium"
        style={{ color: accent }}
      >
        {cta}
        <span aria-hidden className="transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-12 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="mb-1 text-4xl"
        >
          🛟
        </span>
        <h1 className="text-hero font-semibold tracking-tight text-text">
          WingBuddy
        </h1>
        <p className="max-w-md text-lg leading-7 text-text-muted">
          Help at the airport, in any language. Get a calm AI advocate on your
          side — and bring your family into the conversation.
        </p>
      </header>

      <section
        aria-label="Choose how to start"
        className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2"
      >
        <ChoiceCard
          href="/help"
          title="Request help"
          subtitle="One tap connects you to a Hindi-speaking AI advocate who can talk to the airline for you."
          icon="🎙️"
          cta="Tap to get help"
          accent="#007AFF"
        />
        <ChoiceCard
          href="/join"
          title="Join a call"
          subtitle="Open a link a traveler shared with you to follow along and speak when they need you."
          icon="👪"
          cta="Join the conversation"
          accent="#34C759"
        />
      </section>

      <footer className="text-sm text-text-muted">
        Live translation · Real-time status · Your family can see the conversation.
      </footer>
    </main>
  );
}
