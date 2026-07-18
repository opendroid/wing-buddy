// Static airport facilities table (SFO + DEN). Logistics only — the medical
// guardrail (in the brain + VB prompt) never gives medical advice; the most we
// do for a medicine-related ask is point to water / a pharmacy and offer to
// notify family.

export type FacilityNeed =
  | "water"
  | "pharmacy"
  | "rest"
  | "family_restroom"
  | "medical_room";

export interface FacilityResult {
  airport: string;
  need: FacilityNeed;
  result: string; // human-readable, with a terminal/gate anchor
}

const TABLE: Record<string, Record<FacilityNeed, string>> = {
  SFO: {
    water: "Water fountain by Gate F14, Terminal 3.",
    pharmacy: "Walgreens near the Terminal 3 rotunda, past security.",
    rest: "Quiet rest zone in the Terminal 3 mezzanine.",
    family_restroom: "Family restroom beside Gate F12, Terminal 3.",
    medical_room: "Airport medical clinic, Terminal 3 arrivals level.",
  },
  DEN: {
    water: "Water fountain near Gate B30, Concourse B.",
    pharmacy: "The Pharmacy at DEN, Concourse B near the train.",
    rest: "Rest area at the Concourse B mezzanine.",
    family_restroom: "Family restroom by Gate B34, Concourse B.",
    medical_room: "Denver Health medical station, Concourse B level 6.",
  },
};

// Keyword hints (EN + common Hindi) mapped to a need.
const NEED_HINTS: Array<{ need: FacilityNeed; hints: string[] }> = [
  { need: "water", hints: ["water", "पानी", "drink"] },
  { need: "pharmacy", hints: ["pharmacy", "chemist", "दवा की दुकान", "medicine store"] },
  { need: "family_restroom", hints: ["family restroom", "family toilet", "बच्चे", "family bathroom"] },
  { need: "medical_room", hints: ["medical room", "clinic", "nurse", "मेडिकल", "first aid"] },
  { need: "rest", hints: ["rest", "sit", "आराम", "quiet"] },
];

export function detectNeed(text: string): FacilityNeed | null {
  const lower = text.toLowerCase();
  for (const { need, hints } of NEED_HINTS) {
    if (hints.some((h) => lower.includes(h.toLowerCase()))) return need;
  }
  return null;
}

export function lookupFacility(
  airport: string,
  need: FacilityNeed
): FacilityResult | null {
  const byAirport = TABLE[airport?.toUpperCase()];
  if (!byAirport) return null;
  const result = byAirport[need];
  if (!result) return null;
  return { airport: airport.toUpperCase(), need, result };
}
