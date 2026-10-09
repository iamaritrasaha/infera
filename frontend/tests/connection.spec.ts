import { test, expect } from "@playwright/test";

// Deliberately injected transport failures validate the recovery state machine.
test("error: an explicit backend startup response retries and validates health", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({ status: 503, body: '{"detail":"Service is starting"}', contentType: "application/json" })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: '{"status":"ok","project":"Infera","version":"0.5.0","engine_status":"ready"}',
        });
  });
  await page.route("**/api/samples", (route) => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.route("**/api/diagnostic", (route) => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.goto("/dashboard");
  await expect(
    page.getByText("Backend reports that it is starting", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/bounded connection window/i),
  ).toBeVisible();
  await page.clock.fastForward(1500);
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("Engine connected");
  expect(calls).toBe(2);
  await page.clock.fastForward(180000);
  expect(calls, "A completed health check must not restart after navigation-like rerenders").toBe(2);
});

test("error: a generic upstream 503 is retried without claiming a cold start", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return route.fulfill({ status: 503, body: "Unavailable upstream" });
  });
  await page.route("**/api/samples", (route) => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.goto("/dashboard");
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator(".engine-banner")).toContainText("does not identify");
  await expect(page.locator(".engine-banner")).toContainText("Retrying the engine connection");
  await expect(page.locator(".engine-banner")).not.toContainText("Backend reports that it is starting");
  for (const [delay, count] of [[1500, 2], [4000, 3], [8000, 4]]) {
    await page.clock.fastForward(delay);
    await expect.poll(() => calls).toBe(count);
  }
  expect(calls).toBe(4);
  await expect(
    page.getByRole("button", { name: "Retry connection", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".engine-banner[role=alert]")).toContainText("HTTP 503");
  await page.clock.fastForward(300000);
  expect(calls).toBe(4);
  await page.unroute("**/health");
  await page.route("**/health", (route) => {
    calls++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"status":"ok","project":"Infera","version":"0.5.0"}',
    });
  });
  await page.getByRole("button", { name: "Retry connection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry analysis engine connection" })).toContainText("Engine connected");
  expect(calls).toBe(5);
});

test("error: opaque browser network failure stops and manual retry recovers", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return route.abort();
  });
  await page.route("**/api/samples", (route) => route.abort());
  await page.goto("/dashboard");
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator(".engine-banner[role=alert]")).toContainText("unknown browser/network failure");
  await expect(
    page.getByRole("link", { name: "Open backend health check" }),
  ).toHaveAttribute("href", /\/health$/);
  await page.getByRole("button", { name: "View connection diagnostics" }).click();
  await expect(page.locator(".engine-banner")).toContainText("Failure type:");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.clock.fastForward(180000);
  expect(calls, "Visibility changes must not restart a failed sequence").toBe(1);

  await page.unroute("**/health");
  await page.route("**/health", (route) => {
    calls++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"status":"ok","project":"Infera","version":"0.5.0"}',
    });
  });
  await page.getByRole("button", { name: "Retry connection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry analysis engine connection" })).toContainText("Engine connected");
  expect(calls).toBe(2);
});

test("error: an actual browser fetch timeout is reported and retried within bounds", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/health", async () => {
    calls++;
    await new Promise<void>(() => undefined);
  });
  await page.route("**/api/samples", (route) => route.abort());
  await page.goto("/dashboard");
  await expect.poll(() => calls).toBe(1);
  await page.clock.fastForward(25_000);
  await expect(page.locator(".engine-banner")).toContainText("Health request 1 timed out");
  await expect(page.locator(".engine-banner")).toContainText("Retrying the engine connection");
  await page.getByRole("button", { name: "View connection diagnostics" }).click();
  await expect(page.locator(".engine-banner")).toContainText("Failure type:");
  expect(calls).toBe(1);
});

test("error: offline and online browser events recover once", async ({ page }) => {
  let healthCalls = 0;
  await page.route("**/health", (route) => {
    healthCalls++;
    return route.continue();
  });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Retry analysis engine connection" })).toContainText("Engine connected");
  expect(healthCalls).toBe(1);

  await page.context().setOffline(true);
  await expect(page.getByRole("button", { name: "Retry analysis engine connection" })).toContainText("Network offline");
  await page.context().setOffline(false);
  await expect(page.getByRole("button", { name: "Retry analysis engine connection" })).toContainText("Engine connected");
  expect(healthCalls).toBe(2);
});

test("error: an older successful sample response cannot overwrite a newer health failure", async ({
  page,
}) => {
  let releaseSample!: () => void;
  const sampleGate = new Promise<void>((resolve) => { releaseSample = resolve; });
  let healthCalls = 0;
  let sampleCalls = 0;
  await page.route("**/health", (route) => {
    healthCalls++;
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.route("**/api/samples", async (route) => {
    sampleCalls++;
    await sampleGate;
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("/dashboard");
  await expect(page.locator(".engine-banner[role=alert]")).toContainText("expected /health endpoint");
  expect(healthCalls).toBe(1);
  await expect.poll(() => sampleCalls).toBe(1);

  await page.getByRole("button", { name: "Retry connection", exact: true }).click();
  await expect.poll(() => healthCalls).toBe(2);
  await expect(page.locator(".engine-banner[role=alert]")).toContainText("expected /health endpoint");

  const oldSamplesResponse = page.waitForResponse((response) => response.url().endsWith("/api/samples"));
  releaseSample();
  expect((await oldSamplesResponse).status()).toBe(200);
  await expect(page.locator(".engine-banner[role=alert]")).toContainText("expected /health endpoint");
  await expect(page.getByRole("button", { name: "Retry analysis engine connection" })).toContainText("Backend deployment problem");
});

test("error: invalid health schema is incompatible and never claims connected", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"status":"ok"}',
    });
  });
  await page.route("**/api/samples", (route) => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.goto("/dashboard");
  await expect(page.locator(".engine-banner[role=alert]")).toContainText(
    "does not match this frontend version",
  );
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("incompatible");
  expect(calls).toBe(1);
  await page.unroute("**/health");
  await page
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("Engine connected");
});

test("error: a validated API response clears a stale health endpoint failure", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.route("**/api/samples", async (route) => {
    // Let the failed health probe render first, then use the real local API.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.goto("/dashboard");
  await expect(page.locator(".engine-banner[role=alert]")).toContainText(
    "does not provide the expected /health endpoint",
  );
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("Engine connected");
  expect(calls).toBe(1);
});

for (const width of [375, 768, 1366, 1920]) {
  test(`redesigned public pages and preview at ${width}px`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/about", "/docs", "/dashboard"]) {
      await page.goto(path);
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(
          `${path.replaceAll("/", "") || "home"}-${width}.png`,
        ),
        fullPage: true,
      });
    }
    await page.goto("/");
    await page
      .getByRole("button", { name: "Data quality", exact: true })
      .click();
    await expect(
      page.getByText("Duplicate rows", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Distribution", exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: /observations/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View on GitHub", exact: true }),
    ).toHaveAttribute("href", "https://github.com/iamaritrasaha/infera");
    await page
      .getByRole("link", { name: "Start Analyzing", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Upload dataset", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
