import { Suspense } from "react";
import Transcript from "@/components/Transcript";
import StatusCard from "@/components/StatusCard";
import AgentActionLog from "@/components/AgentActionLog";
import FacilitiesCard from "@/components/FacilitiesCard";
import JoinCallButton from "@/components/JoinCallButton";
import DemoOverride from "@/components/DemoOverride";

function DashboardSkeleton({ sessionId }: { sessionId: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Following the call
          </h1>
          <p className="text-sm text-text-muted">
            Session {sessionId.slice(0, 8)}…
          </p>
        </div>
        <DemoOverride />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: bilingual transcript */}
        <section
          aria-label="Live transcript"
          className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-card"
        >
          <Transcript lines={[]} dense showTranslation />
        </section>

        {/* Right: status cards + action log */}
        <aside className="flex flex-col gap-3">
          <StatusCard
            icon="🟢"
            title="Traveler connected"
            tone="success"
          />
          <StatusCard
            icon="✈️"
            title="Flight status"
            detail="Checking…"
            pulsing
          />
          <StatusCard
            icon="♿"
            title="Wheelchair / assistance"
            detail="Not requested yet"
          />
          <FacilitiesCard />
          <AgentActionLog actions={[]} />
        </aside>
      </div>

      <div className="flex justify-center">
        <JoinCallButton state="observing" />
      </div>

      <p className="text-center text-xs text-text-muted">
        Tip: press <kbd className="rounded bg-bg px-1.5 py-0.5">d</kbd> to simulate a
        disruption (presenter only).
      </p>
    </main>
  );
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <Suspense fallback={<div className="p-10 text-text-muted">Loading…</div>}>
      <DashboardSkeleton sessionId={sessionId} />
    </Suspense>
  );
}
