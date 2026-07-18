"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import JoinGate from "@/components/JoinGate";

export default function JoinClient() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(shareCode: string, pin?: string) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode, pin }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessionId?: string;
        t?: string;
      };
      if (!res.ok || !data.sessionId || !data.t) {
        throw new Error(
          data.error === "unknown code"
            ? "We couldn’t find that session. Try the link they texted you."
            : data.error === "invalid PIN"
              ? "Incorrect PIN."
              : data.error || `Could not join (${res.status})`
        );
      }
      router.push(
        `/room/${data.sessionId}?t=${encodeURIComponent(data.t)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
      setBusy(false);
    }
  }

  return <JoinGate onSubmit={onSubmit} error={error} />;
}
