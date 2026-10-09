import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const ARTIFACTS_DIR = path.resolve(__dirname, "../../artifacts/production-verification");

test("live: production verification of Infera v0.4.0", async ({ page }) => {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });

  // 1. Visit production dashboard
  await page.goto("https://infera-omega.vercel.app/dashboard");

  // 2. Verify engine connection is ready and shows connected status
  const engineIndicator = page.getByRole("button", {
    name: "Retry analysis engine connection",
  });
  await expect(engineIndicator).toBeVisible({ timeout: 45_000 });
  await expect(engineIndicator).toContainText("Engine connected");

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "1-dashboard-connected.png"),
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
    path: path.join(ARTIFACTS_DIR, "2-analysis-overview.png"),
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
    path: path.join(ARTIFACTS_DIR, "3-explore-bivariate.png"),
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
    path: path.join(ARTIFACTS_DIR, "4-report-tab.png"),
    fullPage: true,
  });

  // 11. Test manual retry after a transient connection failure & anti-gatekeeper principle
  await page.goto("https://infera-omega.vercel.app/dashboard");
  await expect(engineIndicator).toContainText("Engine connected", { timeout: 30_000 });

  // Inject transport failure for health
  await page.route("**/health", (route) =>
    route.fulfill({ status: 503, body: "Simulated upstream failure" }),
  );

  // Trigger manual check by clicking indicator
  await engineIndicator.click();

  // Verify "Starting the analysis engine" banner appears
  await expect(
    page.getByText("Starting the analysis engine", { exact: true }).first(),
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
    path: path.join(ARTIFACTS_DIR, "5-recovery-verified.png"),
    fullPage: true,
  });
});
