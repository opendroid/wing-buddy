import { Suspense } from "react";
import RoomDashboard from "./RoomDashboard";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <Suspense fallback={<div className="p-10 text-text-muted">Loading…</div>}>
      <RoomDashboard sessionId={sessionId} />
    </Suspense>
  );
}
