// Server-side Vocal Bridge token minting. VB is a managed platform: the backend
// proxies a single call to /api/v1/token with the API key kept server-side, and
// hands the ephemeral token to the client. (See PLAN §"Do we need to build a VB
// agent?": we configure the hosted agent via the vb CLI; we do NOT run it.)
//
// NOTE: VB's documented token body only shows `participant_name`. Whether it
// honors a caller-specified shared `room_name` for the 3-way is unconfirmed
// (Spike A). We send it; relay mode is the fallback regardless.

const VB_TOKEN_URL = "https://vocalbridgeai.com/api/v1/token";

export interface VoiceToken {
  token: string;
  roomName?: string;
  url?: string;
}

export async function mintVoiceToken(params: {
  participantName: string;
  roomName: string;
}): Promise<VoiceToken> {
  const apiKey = process.env.VOICE_BRIDGE_WINGBUDDY;
  if (!apiKey) throw new Error("VOICE_BRIDGE_WINGBUDDY is not set");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
  // VOICE_BRIDGE_WINGBUDDY is an ACCOUNT key — VB requires the target agent id
  // as a header on the token mint (confirmed live: "X-Agent-Id header required
  // when using an account API key"). An agent-scoped key would not need this.
  const agentId = process.env.VB_AGENT_ID;
  if (agentId) headers["X-Agent-Id"] = agentId;

  const res = await fetch(VB_TOKEN_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      participant_name: params.participantName,
      room_name: params.roomName,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`VB token mint failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    token: string;
    room_name?: string;
    url?: string;
  };
  return { token: data.token, roomName: data.room_name, url: data.url };
}
