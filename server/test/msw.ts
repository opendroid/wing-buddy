import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Default hermetic handlers for the external services the server talks to.
// Individual tests can override with `server.use(...)`.
export const handlers = [
  // Vocal Bridge — ephemeral connection token mint.
  http.post("https://vocalbridgeai.com/api/v1/token", async ({ request }) => {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return HttpResponse.json({ error: "missing X-API-Key" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      participant_name?: string;
      room_name?: string;
    };
    return HttpResponse.json({
      token: `vb-test-token-${body.participant_name ?? "anon"}`,
      room_name: body.room_name ?? "vb-test-room",
      url: "wss://vocalbridgeai.test",
    });
  }),

  // Sabre — OAuth2 token endpoint (cert + prod hosts).
  http.post(/\/v2\/auth\/token$/, () =>
    HttpResponse.json({
      access_token: "sabre-test-access-token",
      token_type: "bearer",
      expires_in: 604800,
    })
  ),

  // Sabre InstaFlights (lib/sabre.ts real seedFlight).
  http.get(/\/v1\/shop\/flights/, () =>
    HttpResponse.json({
      PricedItineraries: [
        {
          AirItinerary: {
            OriginDestinationOptions: {
              OriginDestinationOption: [
                {
                  FlightSegment: [
                    {
                      DepartureAirport: { LocationCode: "JFK" },
                      ArrivalAirport: { LocationCode: "LAX" },
                      MarketingAirline: { Code: "B6" },
                      FlightNumber: 3212,
                      DepartureDateTime: "2026-08-15T17:50:00",
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    })
  ),

  // Anthropic Messages API (lib/translate.ts fallback).
  http.post("https://api.anthropic.com/v1/messages", () =>
    HttpResponse.json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: "[[translated]]" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    })
  ),
];

export const server = setupServer(...handlers);
