import { test, expect } from "@playwright/test";
import { apiBase, ApiError, fetchHealth, fetchSamples } from "../lib/api";
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
  for (const [status, message] of [[400, "could not be processed"], [401, "session is missing"], [403, "not authorized"], [404, "expired"], [413, "too large"], [422, "invalid fields"], [429, "another analysis"], [500, "returned HTTP 500"], [503, "does not identify"]] as const) {
    test(`HTTP ${status} has a readable fallback without exposing stack traces`, async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://engine.example";
      globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Traceback File "private.py" Error: secret' }), { status, headers: { "Content-Type": "application/json" } });
      await expect(fetchSamples()).rejects.toThrow(message);
    });
  }
  test("only an explicit backend startup response is classified as cold start", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://engine.example";
    globalThis.fetch = async () => new Response("{\"detail\":\"Service is starting\"}", {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
    let failure: unknown;
    try {
      await fetchHealth();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ kind: "cold-start", status: 503 });
  });
  test("opaque fetch errors remain unknown network failures", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://engine.example";
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await expect(fetchSamples()).rejects.toThrow("unknown browser/network failure");
    await expect(fetchSamples()).rejects.not.toThrow("Render");
  });
  test("request timeout and caller cancellation are classified separately", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://engine.example";
    globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    let timeoutError: unknown;
    try {
      await fetchHealth(undefined, 5);
    } catch (error) {
      timeoutError = error;
    }
    expect(timeoutError).toMatchObject({ kind: "timeout" });

    const controller = new AbortController();
    controller.abort();
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new TypeError("must not run");
    };
    let abortError: unknown;
    try {
      await fetchHealth(controller.signal, 5);
    } catch (error) {
      abortError = error;
    }
    expect(abortError).toMatchObject({ kind: "aborted" });
    expect(fetchCalled).toBe(false);
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
