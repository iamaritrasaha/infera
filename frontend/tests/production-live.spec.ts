import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve(__dirname, "../../artifacts/production-verification");
const PRODUCTION_BASE = process.env.INFERA_E2E_BASE_URL;

test("live: production verification of Infera v0.5.0", async ({ page }) => {
  test.skip(!PRODUCTION_BASE, "Set INFERA_E2E_BASE_URL to run the explicit production release check.");
  test.setTimeout(360_000);
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
  const browserName = page.context().browser()?.browserType().name() ?? "unknown";
  const browserSuffix = `-${browserName}`;
  const expectedApiOrigin = process.env.INFERA_E2E_API_URL ?? "https://infera-backend-tjg3.onrender.com";
  const networkEvidence: Array<Record<string, string | number | null>> = [];
  const captureTasks: Promise<void>[] = [];
  const safeApiUrl = (raw: string) => {
    const url = new URL(raw);
    const path = url.pathname
      .replace(/^\/api\/samples\/[^/]+\/load$/, "/api/samples/:id/load")
      .replace(/^\/api\/results\/[^/]+\/report$/, "/api/results/:id/report")
      .replace(/^\/api\/results\/[^/]+$/, "/api/results/:id");
    return `${url.origin}${path}${url.search}`;
  };
  const safeText = (text: string) => text
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-token]")
    .replace(/(X-Infera-Session\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .slice(0, 500);
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== expectedApiOrigin) return;
    const headers = request.headers();
    networkEvidence.push({
      phase: "request",
      method: request.method(),
      url: safeApiUrl(request.url()),
      origin: headers.origin ?? null,
      preflightMethod: headers["access-control-request-method"] ?? null,
      preflightHeaders: headers["access-control-request-headers"] ?? null,
    });
  });
  page.on("response", (response) => {
    if (new URL(response.url()).origin !== expectedApiOrigin) return;
    captureTasks.push((async () => {
      const headers = await response.allHeaders();
      const timing = response.request().timing();
      networkEvidence.push({
        phase: "response",
        method: response.request().method(),
        url: safeApiUrl(response.url()),
        status: response.status(),
        allowOrigin: headers["access-control-allow-origin"] ?? null,
        allowHeaders: headers["access-control-allow-headers"] ?? null,
        allowMethods: headers["access-control-allow-methods"] ?? null,
        requestId: headers["x-request-id"] ?? null,
        contentType: headers["content-type"] ?? null,
        requestDurationMs: timing.responseEnd >= 0 ? Math.round(timing.responseEnd) : null,
      });
    })());
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin !== expectedApiOrigin) return;
    networkEvidence.push({
      phase: "failure",
      method: request.method(),
      url: safeApiUrl(request.url()),
      error: safeText(request.failure()?.errorText ?? "unknown"),
    });
  });
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(safeText(message.text()));
  });
  page.on("pageerror", (error) => runtimeErrors.push(safeText(error.message)));
  await page.addInitScript(() => {
    const visibility: Array<{ at: number; state: string }> = [];
    (window as Window & { __inferaVisibility?: Array<{ at: number; state: string }> }).__inferaVisibility = visibility;
    visibility.push({ at: Date.now(), state: document.visibilityState });
    document.addEventListener("visibilitychange", () => visibility.push({ at: Date.now(), state: document.visibilityState }));
  });

  // 1. Visit production dashboard
  await page.goto(new URL("/dashboard", PRODUCTION_BASE!).toString());

  // 2. Verify engine connection is ready and shows connected status
  const engineIndicator = page.getByRole("button", {
    name: "Retry analysis engine connection",
  });
  await expect(engineIndicator).toBeVisible({ timeout: 150_000 });
  await expect(engineIndicator).toContainText("Engine connected", { timeout: 150_000 });

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, `1-dashboard-connected${browserSuffix}.png`),
    fullPage: true,
  });

  // 3. Verify instant preview example works zero-wait
  const instantPreviewBtn = page.getByRole("button", {
    name: "View Full Analysis",
  });
  await expect(instantPreviewBtn).toBeVisible();

  // 4. Select real sample dataset "Housing Prices"
  const housingBtn = page.getByRole("button", { name: /Housing Prices/ });
  await expect(housingBtn).toBeVisible();
  await housingBtn.click();

  // 5. Verify goal selector is available and defaults to Discover Insights
  await expect(page.getByText("Choose Analysis Goal")).toBeVisible();
  await expect(page.getByText("Goal: Discover Insights")).toBeVisible();
  const discoverInsightsBtn = page.getByRole("button", { name: /Discover Insights/i });
  await expect(discoverInsightsBtn).toBeVisible();

  // Verify target column selector
  const targetSelector = page.getByLabel("Analysis target");
  await expect(targetSelector).toBeVisible();
  await targetSelector.selectOption("price");

  // 6. Launch full live analysis on production Render backend
  const analyzeResponsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/analyze") &&
      resp.request().method() === "POST" &&
      resp.status() === 200,
    { timeout: 120_000 },
  );

  const launchBtn = page.getByRole("button", { name: "Launch Full Analysis" });
  await expect(launchBtn).toBeVisible();
  await launchBtn.click();

  const analyzeResponse = await analyzeResponsePromise;
  expect(analyzeResponse.status()).toBe(200);

  // 7. Verify analysis views render correctly
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "What this data contains" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Key findings" }),
  ).toBeVisible();

  // Check evidence patterns status
  await expect(page.getByText(/Found \d+ evidence-backed pattern/)).toBeVisible();

  // Check findings cards
  const evidenceDetails = page.locator("details summary", {
    hasText: "Evidence and limitation",
  });
  expect(await evidenceDetails.count()).toBeGreaterThan(0);
  await evidenceDetails.first().click();

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, `2-analysis-overview${browserSuffix}.png`),
    fullPage: true,
  });

  // 8. Test Explore Tab and Bivariate Comparative Picker
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Two-Variable Interactive Comparison/i }),
  ).toBeVisible();

  // Test suggested question chips if available
  const questionChips = page.locator("button").filter({ hasText: /→/ });
  if ((await questionChips.count()) > 0) {
    await questionChips.first().click();
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, `3-explore-bivariate${browserSuffix}.png`),
    fullPage: true,
  });

  // 9. Test Chart PNG Export
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  const exportPngBtn = page.getByRole("button", { name: "Export PNG" }).first();
  if (await exportPngBtn.isVisible()) {
    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await exportPngBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".png");
  }

  // 10. Test Report Downloads (MD and HTML)
  await page.getByRole("tab", { name: "Report", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();

  for (const [btnName, ext] of [
    ["Download .MD", ".md"],
    ["Download .HTML", ".html"],
  ]) {
    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await page.getByRole("button", { name: btnName, exact: true }).click();
    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toContain(ext);
    const content = await fs.readFile((await dl.path())!, "utf8");
    expect(content).toContain("INFERA DATA SCIENCE EVIDENCE REPORT");
    expect(content).toContain("Aritra Saha");
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, `4-report-tab${browserSuffix}.png`),
    fullPage: true,
  });

  // 11. Refresh the fresh browser tab and repeat a real sample analysis and
  // both report downloads while retaining the browser's isolated session.
  await page.reload();
  await expect(engineIndicator).toContainText("Engine connected", { timeout: 150_000 });
  await page.getByRole("button", { name: /Housing Prices/ }).click();
  await page.getByLabel("Analysis target").selectOption("price");
  const repeatedAnalysisPromise = page.waitForResponse((response) =>
    response.url().includes("/api/analyze") && response.request().method() === "POST",
    { timeout: 120_000 },
  );
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  const repeatedAnalysis = await repeatedAnalysisPromise;
  expect(repeatedAnalysis.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "What this data contains" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Report", exact: true }).click();
  for (const [btnName, ext] of [
    ["Download .MD", ".md"],
    ["Download .HTML", ".html"],
  ]) {
    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await page.getByRole("button", { name: btnName, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(ext);
    const content = await fs.readFile((await download.path())!, "utf8");
    expect(content).toContain("INFERA DATA SCIENCE EVIDENCE REPORT");
    expect(content).toContain("Aritra Saha");
  }

  // 12. Test manual retry after a transient connection failure.
  await page.goto(new URL("/dashboard", PRODUCTION_BASE!).toString());
  await expect(engineIndicator).toContainText("Engine connected", { timeout: 30_000 });

  // Inject transport failure for health
  await page.route("**/health", (route) =>
    route.fulfill({ status: 503, body: "Simulated upstream failure" }),
  );

  // Trigger manual check by clicking indicator
  await engineIndicator.click();

  // A generic 503 stays a generic upstream retry, not a cold-start claim.
  await expect(
    page.getByText("Retrying the engine connection", { exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // Unroute to restore healthy backend
  await page.unroute("**/health");

  // Confirm recovery to "Engine connected" and no permanent lock
  await expect(engineIndicator).toContainText("Engine connected", {
    timeout: 30_000,
  });

  // Verify user can still interact and select dataset
  await expect(page.getByRole("button", { name: /Housing Prices/ })).toBeVisible();

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, `5-recovery-verified${browserSuffix}.png`),
    fullPage: true,
  });
  await Promise.all(captureTasks);
  await fs.writeFile(
    path.join(ARTIFACTS_DIR, `v0.5-engine-connectivity-network${browserSuffix}.json`),
    `${JSON.stringify({
      browser: browserName,
      dashboardOrigin: new URL(PRODUCTION_BASE!).origin,
      apiOrigin: expectedApiOrigin,
      visibility: await page.evaluate(() => (window as Window & { __inferaVisibility?: Array<{ at: number; state: string }> }).__inferaVisibility ?? []),
      consoleErrors: runtimeErrors,
      requests: networkEvidence,
      secretsCaptured: false,
    }, null, 2)}\n`,
  );
});

test("live: production CSV exploration, filtered reports, and session isolation", async ({ page }) => {
  test.skip(!PRODUCTION_BASE, "Set INFERA_E2E_BASE_URL to run the explicit production release check.");
  test.setTimeout(360_000);
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });

  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto(new URL("/dashboard", PRODUCTION_BASE!).toString());
  const engineIndicator = page.getByRole("button", { name: "Retry analysis engine connection" });
  await expect(engineIndicator).toContainText("Engine connected", { timeout: 150_000 });

  const csv = ["when,revenue,other,region", ...Array.from({ length: 40 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10);
    const region = index < 20 ? "north" : "south";
    const revenue = index < 20 ? 10 + index : 100 + index;
    return `${date},${revenue},${index * 2 + 1},${region}`;
  })].join("\n");
  const uploadStarted = Date.now();
  const uploadResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/upload") && response.request().method() === "POST",
  );
  await page.getByLabel("Dataset file").setInputFiles({
    name: "production-regional-trend.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.status()).toBe(201);
  const uploadLatencyMs = Date.now() - uploadStarted;
  const expectedApiOrigin = process.env.INFERA_E2E_API_URL ?? "https://infera-backend-tjg3.onrender.com";
  expect(new URL(uploadResponse.url()).origin).toBe(expectedApiOrigin);

  const analysisStarted = Date.now();
  const analysisResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/analyze") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  const analysisResponse = await analysisResponsePromise;
  expect(analysisResponse.status()).toBe(200);
  const analysisLatencyMs = Date.now() - analysisStarted;
  const analysisRequest = analysisResponse.request().postDataJSON() as { dataset_id: string };
  expect(analysisRequest.dataset_id).toBeTruthy();
  await expect(page.getByRole("heading", { name: "What this data contains" })).toBeVisible({ timeout: 150_000 });

  // The configured CORS policy admits this browser request, but an unrelated
  // session token must still be unable to read this dataset's computed result.
  const foreignSessionStatus = await page.evaluate(async ({ apiOrigin, datasetId }) => {
    const response = await fetch(`${apiOrigin}/api/results/${encodeURIComponent(datasetId)}`, {
      headers: { "X-Infera-Session": "0".repeat(64) },
      credentials: "omit",
    });
    return response.status;
  }, { apiOrigin: expectedApiOrigin, datasetId: analysisRequest.dataset_id });
  expect(foreignSessionStatus).toBe(404);

  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Interactive Data Explorer" })).toBeVisible();
  const groupQuestion = page.getByRole("button", { name: /revenue.*vary across.*region/i });
  const groupStarted = Date.now();
  const groupResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/explore") && response.request().method() === "POST",
  );
  await groupQuestion.click();
  const groupResponse = await groupResponsePromise;
  expect(groupResponse.status()).toBe(200);
  const groupLatencyMs = Date.now() - groupStarted;
  const groupTable = page.getByRole("table").filter({ hasText: "Sample size" });
  await expect(groupTable).toContainText("19.5");
  await expect(groupTable).toContainText("129.5");

  await page.getByRole("button", { name: "Add filter" }).click();
  const optionsResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/explore/options"),
  );
  await page.getByLabel("Filter column").selectOption("region");
  expect((await optionsResponsePromise).status()).toBe(200);
  await page.getByLabel("Values to include for region").selectOption("north");
  const filterStarted = Date.now();
  const filteredResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/explore") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  const filteredResponse = await filteredResponsePromise;
  expect(filteredResponse.status()).toBe(200);
  const filterLatencyMs = Date.now() - filterStarted;
  await expect(page.getByText(/20 of 40 rows matched the filters/)).toBeVisible();
  await expect(groupTable).toContainText("19.5");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "6-interactive-explorer-filtered.png"),
    fullPage: true,
  });

  const [aggregateDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download aggregate CSV" }).click(),
  ]);
  const aggregateCsv = await fs.readFile((await aggregateDownload.path())!, "utf8");
  expect(aggregateCsv).toContain('"north","19.5","20"');
  expect(aggregateCsv.trim().split(/\r?\n/)).toHaveLength(2);

  const dateOptionsPromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/explore/options"),
  );
  await page.getByRole("tab", { name: "Trend explorer" }).click();
  expect((await dateOptionsPromise).status()).toBe(200);
  await expect(page.getByLabel("Trend period")).toBeEnabled();
  await page.getByLabel("Trend period").selectOption("D");
  const trendStarted = Date.now();
  const trendResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/explore") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Run exploration" }).click();
  const trendResponse = await trendResponsePromise;
  expect(trendResponse.status()).toBe(200);
  const trendLatencyMs = Date.now() - trendStarted;
  const trendTable = page.getByRole("table").filter({ hasText: "Period" });
  await expect(trendTable).toContainText("2025-01-01");
  await expect(trendTable).toContainText("2025-01-20");
  await expect(trendTable.locator("tbody tr")).toHaveCount(20);

  await page.getByRole("tab", { name: "Report", exact: true }).click();
  await expect(page.locator(".evidence-report pre")).toContainText("Interactive exploration");
  await expect(page.locator(".evidence-report pre")).toContainText("20 of 40 matched the filters");
  const [htmlReport] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download .HTML", exact: true }).click(),
  ]);
  const htmlContents = await fs.readFile((await htmlReport.path())!, "utf8");
  expect(htmlContents).toContain("Interactive exploration");
  expect(htmlContents).toContain("20 of 40 matched the filters");
  expect(htmlContents).not.toContain("<script>");
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "7-filtered-report.png"),
    fullPage: true,
  });

  expect(runtimeErrors).toEqual([]);
  await fs.writeFile(
    path.join(ARTIFACTS_DIR, `v0.5-production-timings-${page.context().browser()?.browserType().name() ?? "unknown"}.json`),
    `${JSON.stringify({ uploadLatencyMs, analysisLatencyMs, groupLatencyMs, filterLatencyMs, trendLatencyMs }, null, 2)}\n`,
  );
});
