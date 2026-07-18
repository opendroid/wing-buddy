// Sabre client behind SABRE_MODE (real | mock).
//
// The hackathon token is a CERT-environment bearer scoped to shopping APIs
// (InstaFlights) — no PNR/booking entitlement. So in real mode we get REAL
// flight data (carrier / number / scheduled departure) from Sabre for the
// seeded flight, and keep SSR (WCHR) session-local — the demo's drop/re-add
// climax runs against our own session state (/api/demo/disrupt), not Sabre.
// Any Sabre error degrades to the deterministic mock (callers also fall back).

import type { Flight } from "./session-store";
import type { SSRState } from "./events";

export type SabreMode = "real" | "mock";

export function sabreMode(): SabreMode {
  return process.env.SABRE_MODE === "real" ? "real" : "mock";
}

// Deterministic demo fixture (PLAN.md:187): UA 2348, 4:15pm, Gate 14A.
const MOCK_FLIGHT: Flight = {
  carrier: "UA",
  number: "2348",
  date: "2026-07-18",
  origin: "SFO",
  dest: "DEN",
  schedDep: "2026-07-18T16:15:00-07:00",
  status: "on_time",
  gate: "14A",
  delayMin: 0,
};

export interface FlightStatusResult {
  status: Flight["status"];
  schedDep: string;
  gate?: string;
  delayMin: number;
}

function bearer(): string {
  const t = process.env.SABRE_HACKATHON_ACCESS_TOKEN?.trim();
  if (!t) throw new Error("SABRE_HACKATHON_ACCESS_TOKEN not set");
  return t;
}

function baseUrl(): string {
  return (
    process.env.SABRE_BASE_URL || "https://api-crt.cert.havail.sabre.com"
  ).replace(/\/+$/, "");
}

async function sabreGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(baseUrl() + path, {
    headers: { Authorization: `Bearer ${bearer()}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Sabre ${res.status} on ${path}: ${(await res.text()).slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

// A near-future date InstaFlights (cert) will price.
function shopDate(): string {
  return new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

// InstaFlights Search — real Sabre shopping data. Returns the first segment of
// the cheapest itinerary, mapped to our Flight shape (gate/status not in
// shopping data, so those default).
async function instaFlight(origin: string, dest: string): Promise<Flight | null> {
  const date = shopDate();
  const j = await sabreGet<{
    PricedItineraries?: Array<{
      AirItinerary?: {
        OriginDestinationOptions?: {
          OriginDestinationOption?: Array<{
            FlightSegment?: Array<{
              DepartureAirport?: { LocationCode?: string };
              ArrivalAirport?: { LocationCode?: string };
              MarketingAirline?: { Code?: string };
              FlightNumber?: number;
              DepartureDateTime?: string;
            }>;
          }>;
        };
      };
    }>;
  }>(
    `/v1/shop/flights?origin=${origin}&destination=${dest}&departuredate=${date}&pointofsalecountry=US&limit=1`
  );

  const seg =
    j.PricedItineraries?.[0]?.AirItinerary?.OriginDestinationOptions
      ?.OriginDestinationOption?.[0]?.FlightSegment?.[0];
  if (!seg || !seg.MarketingAirline?.Code || seg.FlightNumber == null) return null;

  return {
    carrier: seg.MarketingAirline.Code,
    number: String(seg.FlightNumber),
    date,
    origin: seg.DepartureAirport?.LocationCode ?? origin,
    dest: seg.ArrivalAirport?.LocationCode ?? dest,
    schedDep: seg.DepartureDateTime ?? `${date}T16:15:00`,
    status: "on_time",
    gate: MOCK_FLIGHT.gate, // real gate isn't in Sabre shopping data
    delayMin: 0,
  };
}

// --- Public interface (the swappable seam) ---

export async function seedFlight(): Promise<Flight> {
  if (sabreMode() === "mock") return { ...MOCK_FLIGHT };
  const [origin, dest] = (process.env.SABRE_DEMO_ROUTE || "JFK-LAX").split("-");
  const real = await instaFlight(origin, dest); // throws on API error → caller falls back
  return real ?? { ...MOCK_FLIGHT };
}

export async function getFlightStatus(
  _carrier: string,
  _number: string,
  _date: string
): Promise<FlightStatusResult> {
  // Live per-flight status isn't in the token's entitlements; return the mock
  // baseline (the demo's status changes are session-local via /api/demo/disrupt).
  return {
    status: MOCK_FLIGHT.status,
    schedDep: MOCK_FLIGHT.schedDep,
    gate: MOCK_FLIGHT.gate,
    delayMin: MOCK_FLIGHT.delayMin,
  };
}

export async function rebook(
  _pnr: string,
  _criteria: unknown
): Promise<{ carrier: string; number: string; schedDep: string; gate?: string }> {
  return {
    carrier: MOCK_FLIGHT.carrier,
    number: MOCK_FLIGHT.number,
    schedDep: MOCK_FLIGHT.schedDep,
    gate: MOCK_FLIGHT.gate,
  };
}

// SSR is session-local (no booking entitlement on the cert token) in both modes.
export async function readSSR(_pnr: string): Promise<SSRState> {
  return "confirmed";
}

export async function addSSR(_pnr: string, _code = "WCHR"): Promise<SSRState> {
  return "reconfirmed";
}
