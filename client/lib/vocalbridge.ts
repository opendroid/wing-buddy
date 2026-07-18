// Shared VocalBridge config (CLAUDE.md + PLAN-v2 §4.5).
// The browser talks to VB directly over WebRTC; our server only MINTS tokens
// via /api/voice-token and never calls the agent. This module centralizes the
// env reads + the token response shape the endpoint must return.

export interface VoiceTokenResponse {
  url: string;
  token: string;
  room_name: string;
  participant_identity: string;
  expires_in: number;
  agent_mode?: string;
}

export function vbAgentId(): string | undefined {
  return process.env.VB_AGENT_ID;
}

export function vbApiKeyPresent(): boolean {
  return Boolean(process.env.VOCAL_BRIDGE_API_KEY);
}

/**
 * Placeholder token mint. Real minting happens at Spike A (shared-room 3-way)
 * via the VB SDK/token service. For Hour 1 we return an empty token so the
 * route shape + types are fixed and the client can be wired without live creds.
 */
export function placeholderToken(roomName: string, identity: string): VoiceTokenResponse {
  return {
    url: "",
    token: "",
    room_name: roomName,
    participant_identity: identity,
    expires_in: 3600,
    agent_mode: "Agent",
  };
}
