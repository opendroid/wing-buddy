import { describe, it, expect } from "vitest";
import { corsHeadersFor } from "@/lib/withCors";

// CORS_ALLOWED_ORIGINS is "https://client.test" in the test env (test/setup.ts).
// corsHeadersFor is the single source of truth used by both the middleware
// (production) and the route wrapper. Live/production CORS is covered by
// scripts/smoke.sh; this locks the decision logic.
describe("corsHeadersFor", () => {
  it("echoes an allowed origin as ACAO, with the base preflight headers", () => {
    const h = corsHeadersFor("https://client.test");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://client.test");
    expect(h["Access-Control-Allow-Methods"]).toContain("POST");
    expect(h["Access-Control-Allow-Headers"]).toContain("x-wb-key");
    expect(h["Vary"]).toBe("Origin");
  });

  it("omits ACAO for a disallowed origin (base headers still present)", () => {
    const h = corsHeadersFor("https://evil.test");
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Access-Control-Allow-Methods"]).toBeTruthy();
  });

  it("omits ACAO when there is no origin", () => {
    expect(corsHeadersFor(null)["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
