import { test, expect } from "@playwright/test";
import { apiBase, fetchSamples } from "../lib/api";
import { analysisSchema } from "../lib/response-schemas";

// Transport failures are simulated here; full workflows use the real FastAPI engine.
test.describe("API client contracts", () => {
  const originalFetch = globalThis.fetch;
  const originalAPI = process.env.NEXT_PUBLIC_API_URL;
  const originalMode = process.env.NODE_ENV;
  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalAPI === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalAPI;
    Object.assign(process.env, { NODE_ENV: originalMode });
  });
  test("missing and invalid production configuration never falls back to localhost", () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(() => apiBase()).toThrow("not configured");
    for (const value of ["garbage", "https://engine.example/api", "https://user:secret@engine.example", "https://engine.example?key=private", "ftp://engine.example"]) {
      process.env.NEXT_PUBLIC_API_URL = value;
      expect(() => apiBase()).toThrow();
    }
    process.env.NEXT_PUBLIC_API_URL = "https://engine.example/";
    expect(apiBase()).toBe("https://engine.example");
  });
  for (const [status, message] of [[400, "could not be processed"], [401, "session is missing"], [403, "not authorized"], [404, "expired"], [413, "too large"], [422, "invalid fields"], [429, "another analysis"], [500, "returned HTTP 500"], [503, "starting"]] as const) {
    test(`HTTP ${status} has a readable fallback without exposing stack traces`, async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://engine.example";
      globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Traceback File "private.py" Error: secret' }), { status, headers: { "Content-Type": "application/json" } });
      await expect(fetchSamples()).rejects.toThrow(message);
    });
  }
  test("network and CORS-style failures explain engine availability", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://engine.example";
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await expect(fetchSamples()).rejects.toThrow("could not be reached");
  });
  test("invalid JSON or response structure never reaches chart rendering", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://engine.example";
    for (const body of ["not JSON", '{"wrong":"shape"}', '[{"id":"incomplete"}]']) {
      globalThis.fetch = async () => new Response(body, { headers: { "Content-Type": "application/json" } });
      await expect(fetchSamples()).rejects.toThrow("does not match this frontend version");
    }
    expect(analysisSchema.safeParse({ modeling: {} }).success).toBe(false);
  });
});
