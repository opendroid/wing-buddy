import { describe, it, expect, afterEach, vi } from "vitest";
import { seedFlight, sabreMode } from "@/lib/sabre";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sabre", () => {
  it("mock mode returns the deterministic fixture", async () => {
    vi.stubEnv("SABRE_MODE", "mock");
    expect(sabreMode()).toBe("mock");
    const f = await seedFlight();
    expect(f).toMatchObject({ carrier: "UA", number: "2348", gate: "14A" });
  });

  it("real mode parses live InstaFlights data (mocked)", async () => {
    vi.stubEnv("SABRE_MODE", "real");
    vi.stubEnv("SABRE_HACKATHON_ACCESS_TOKEN", "cert-token");
    vi.stubEnv("SABRE_BASE_URL", "https://api-crt.cert.havail.sabre.com");
    const f = await seedFlight();
    expect(f.carrier).toBe("B6");
    expect(f.number).toBe("3212");
    expect(f.origin).toBe("JFK");
    expect(f.dest).toBe("LAX");
    expect(f.schedDep).toBe("2026-08-15T17:50:00");
    expect(f.status).toBe("on_time");
  });
});
