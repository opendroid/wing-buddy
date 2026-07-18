import { describe, it, expect } from "vitest";
import { detectNeed, lookupFacility } from "@/lib/facilities";

describe("facilities", () => {
  it("detects needs from EN + HI hints", () => {
    expect(detectNeed("where is the water")).toBe("water");
    expect(detectNeed("मुझे पानी चाहिए")).toBe("water");
    expect(detectNeed("nearest pharmacy")).toBe("pharmacy");
    expect(detectNeed("I need to find a quiet place to rest")).toBe("rest");
    expect(detectNeed("family restroom please")).toBe("family_restroom");
    expect(detectNeed("hello there")).toBeNull();
  });

  it("looks up SFO and DEN facilities with a location anchor", () => {
    expect(lookupFacility("SFO", "water")?.result).toMatch(/Terminal 3/);
    expect(lookupFacility("den", "pharmacy")?.result).toMatch(/Concourse B/);
    expect(lookupFacility("JFK", "water")).toBeNull();
  });
});
