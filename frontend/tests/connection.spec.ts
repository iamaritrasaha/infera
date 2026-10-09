import { test, expect } from "@playwright/test";

// Deliberately injected transport failures validate the recovery state machine.
// Real workflows in workflows.spec.ts never mock computation or health responses.
test("error: transient health response retries then validates the real backend", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({ status: 503, body: "Starting upstream" })
      : route.continue();
  });
  await page.goto("/dashboard");
  await expect(
    page.getByText("Starting the analysis engine", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/bounded health checks allow up to two minutes/i),
  ).toBeVisible();
  await page.clock.fastForward(2000);
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("Engine connected");
  expect(calls).toBe(2);
  await page.getByRole("button", { name: /Housing Prices/ }).click();
  await page.getByLabel("Analysis target").selectOption("price");
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible({ timeout: 150000 });
  await page.clock.fastForward(120000);
  expect(calls, "Rendering analysis must not restart the connection loop").toBe(
    2,
  );
});

test("error: a Render-like cold start can take over ninety seconds", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return calls < 9
      ? route.fulfill({ status: 503, body: "Instance is waking" })
      : route.fulfill({
          status: 200,
          contentType: "application/json",
          body: '{"status":"ok","project":"Infera","version":"0.1.0"}',
        });
  });
  await page.goto("/dashboard");
  await expect.poll(() => calls).toBe(1);
  for (const [delay, count] of [
    [2000, 2],
    [4000, 3],
    [8000, 4],
    [12000, 5],
    [16000, 6],
    [20000, 7],
    [20000, 8],
    [20000, 9],
  ]) {
    await page.clock.fastForward(delay);
    await expect.poll(() => calls).toBe(count);
  }
  expect(calls).toBe(9);
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("Engine connected");
  expect(calls).toBe(9);
});

test("error: bounded health attempts stop, with manual recovery", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return route.fulfill({ status: 503, body: "Unavailable upstream" });
  });
  await page.goto("/dashboard");
  await expect.poll(() => calls).toBe(1);
  for (const [delay, count] of [
    [2000, 2],
    [4000, 3],
    [8000, 4],
    [12000, 5],
    [16000, 6],
    [20000, 7],
    [20000, 8],
    [20000, 9],
  ]) {
    await page.clock.fastForward(delay);
    await expect.poll(() => calls).toBe(count);
  }
  await expect(
    page.getByRole("button", { name: "Retry connection", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".engine-banner[role=alert]")).toContainText(
    "HTTP 503",
  );
  await page.clock.fastForward(300000);
  expect(calls).toBe(9);
  await page.unroute("**/health");
  await page
    .getByRole("button", { name: "Retry connection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("Engine connected");
  await expect(
    page.getByRole("button", { name: /Housing Prices/ }),
  ).toBeVisible();
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

test("error: a missing health endpoint is reported as a deployment problem", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/health", (route) => {
    calls++;
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto("/dashboard");
  await expect(page.locator(".engine-banner[role=alert]")).toContainText(
    "does not provide the expected /health endpoint",
  );
  await expect(
    page.getByRole("button", { name: "Retry analysis engine connection" }),
  ).toContainText("Backend deployment problem");
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
