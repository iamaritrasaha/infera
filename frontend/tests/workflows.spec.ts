import { test, expect, Page, Request } from "@playwright/test";
import fs from "node:fs/promises";

const csv =
  "measurement,second,constant,group,target\n" +
  Array.from(
    { length: 40 },
    (_, i) => `${i - 20},${i * i},5,${i % 2 ? "A" : "B"},${i * 2.5 - 50}`,
  ).join("\n");
const runtimeErrors: string[] = [];
const navigationCancellations: string[] = [];
test.beforeEach(async ({ page }) => {
  runtimeErrors.length = 0;
  navigationCancellations.length = 0;
  const successfulRscRequests = new WeakSet<Request>();
  page.on("response", (response) => {
    const request = response.request();
    const url = new URL(request.url());
    if (
      response.status() === 200 &&
      request.method() === "GET" &&
      url.origin === new URL(page.url()).origin &&
      url.searchParams.has("_rsc")
    ) {
      successfulRscRequests.add(request);
    }
  });
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") runtimeErrors.push(m.text());
  });
  page.on("requestfailed", (request) => {
    const message = `${request.method()} ${request.url()} ${request.failure()?.errorText}`;
    // Navigating away can cancel a Next.js RSC stream after its HTTP 200 response.
    // Keep API failures, other network errors, and cancellations before a response fatal.
    if (
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      successfulRscRequests.has(request)
    ) {
      navigationCancellations.push(message);
      return;
    }
    runtimeErrors.push(message);
  });
});
test.afterEach(async ({}, info) => {
  if (navigationCancellations.length)
    await info.attach("successful-rsc-navigation-cancellations", {
      body: navigationCancellations.join("\n"),
      contentType: "text/plain",
    });
  if (!info.title.startsWith("error:"))
    expect(runtimeErrors, "Browser errors or failed network requests").toEqual(
      [],
    );
});
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function analyze(page: Page, sample: string) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: new RegExp(sample) }).click();
  await expect(
    page.getByRole("button", { name: "Launch Full Analysis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible({ timeout: 150_000 });
}

for (const width of [375, 768, 1366, 1920]) {
  test(`real housing workflow and responsive views at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByText("Open Source", { exact: true })).toBeVisible();
    await expect(page.getByText("SaaS MVP")).toHaveCount(0);
    await noOverflow(page);
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "About", exact: true })
      .click();
    await expect(
      page.getByText("Aritra Saha", { exact: false }).first(),
    ).toBeVisible();
    expect(await page.locator("main").innerText()).not.toContain(
      String.fromCharCode(8212),
    );
    await noOverflow(page);
    await page.screenshot({
      path: info.outputPath(`about-${width}.png`),
      fullPage: true,
    });
    await analyze(page, "Housing Prices");
    await page.getByRole("tab", { name: "Overview", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Data Quality", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(
      page.getByRole("tab", { name: "Overview", exact: true }),
    ).toBeFocused();
    for (const tab of [
      "Overview",
      "Data Quality",
      "Explore",
      "Statistics",
      "Machine Learning",
      "Insights",
      "Report",
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
      await expect(page.getByText("This view could not render.")).toHaveCount(
        0,
      );
      await noOverflow(page);
      if (tab === "Machine Learning") {
        await expect(
          page.getByRole("heading", {
            name: "Model Benchmarking & Validation",
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: "Principal Component Analysis",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: "Unsupervised Segmentation Analysis",
          }),
        ).toBeVisible();
        await page.screenshot({
          path: info.outputPath(`models-${width}.png`),
          fullPage: true,
        });
      }
      if (tab === "Insights") {
        await page
          .getByRole("button", { name: /View Evidence/i })
          .first()
          .click();
        await expect(
          page.getByText("Methodology & Formula:", { exact: false }).first(),
        ).toBeVisible();
        await noOverflow(page);
      }
    }
    for (const [button, extension] of [
      ["Download .MD", ".md"],
      ["Download .HTML", ".html"],
    ]) {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: button, exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain(extension);
      const content = await fs.readFile((await download.path())!, "utf8");
      expect(content).toContain("INFERA DATA SCIENCE EVIDENCE REPORT");
      expect(content).toContain("Aritra Saha");
    }
    if (width === 1366) {
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Copy Markdown" }).click();
      await expect(
        page.getByRole("button", { name: "Copied", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => navigator.clipboard.readText()),
      ).toContain("INFERA DATA SCIENCE EVIDENCE REPORT");
      await page.evaluate(() => {
        document.body.dataset.printObserved = "false";
        window.addEventListener(
          "beforeprint",
          () => {
            document.body.dataset.printObserved = "true";
          },
          { once: true },
        );
      });
      await page.getByRole("button", { name: "Print / PDF" }).click();
      await expect(page.locator("body")).toHaveAttribute(
        "data-print-observed",
        "true",
      );
      await page.pdf({
        path: info.outputPath("housing-report.pdf"),
        format: "A4",
      });
    }
    await page.getByRole("button", { name: "Choose another dataset" }).click();
    await expect(
      page.getByRole("button", { name: "Upload dataset", exact: true }),
    ).toBeVisible();
  });
}

test("real CSV upload, negative values, constants, charts and rerun", async ({
  page,
}, info) => {
  await page.goto("/dashboard");
  await page.getByLabel("Dataset file").setInputFiles({
    name: "uploaded.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByLabel("Analysis target", { exact: true })
    .selectOption("target");
  const computation = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  const response = await computation;
  expect(response.status()).toBe(200);
  // Verify the owned cached payload after the browser consumes the streaming POST body.
  await expect(
    page.getByRole("tab", { name: "Statistics", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(
    async ({ origin, datasetId }) => {
      const fetched = await fetch(`${origin}/api/results/${datasetId}`, {
        headers: {
          "X-Infera-Session": sessionStorage.getItem("infera-session")!,
        },
      });
      if (!fetched.ok)
        throw new Error(`Result verification failed: ${fetched.status}`);
      return fetched.json();
    },
    {
      origin: new URL(response.url()).origin,
      datasetId: response.request().postDataJSON().dataset_id,
    },
  );
  expect(result.schema.row_count).toBe(40);
  expect(
    result.descriptive_statistics.numerical.find(
      (c: { column: string }) => c.column === "measurement",
    ).mean,
  ).toBe(-0.5);
  expect(
    result.descriptive_statistics.numerical.find(
      (c: { column: string }) => c.column === "target",
    ).mean,
  ).toBe(-1.25);
  await info.attach("actual-csv-analysis", {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
  await expect(
    page.getByRole("tab", { name: "Statistics", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Statistics", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("constant");
  await expect(page.getByRole("tabpanel")).toContainText("Unavailable");
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await page
    .getByRole("tab", { name: "Machine Learning", exact: true })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText("RMSE");
  await page.getByRole("button", { name: "Re-Run Pipeline" }).click();
  await expect(
    page.getByRole("button", { name: "Re-Run Pipeline" }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Report", exact: true }).click();
  for (const label of ["Download .MD", "Download .HTML"]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await pending;
    const content = await fs.readFile((await download.path())!, "utf8");
    expect(content).toContain("-0.5");
    expect(content).toContain("Aritra Saha");
    await download.saveAs(info.outputPath(download.suggestedFilename()));
  }
  await noOverflow(page);
});

test("real drag and drop CSV and keyboard upload access", async ({ page }) => {
  await page.goto("/dashboard");
  const zone = page.getByRole("button", {
    name: "Upload dataset",
    exact: true,
  });
  await zone.focus();
  await expect(zone).toBeFocused();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (
    await chooserPromise
  ).setFiles({
    name: "keyboard.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByRole("button", { name: "Launch Full Analysis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Upload Different File" }).click();
  const dataTransfer = await page.evaluateHandle((text) => {
    const data = new DataTransfer();
    data.items.add(new File([text], "dropped.csv", { type: "text/csv" }));
    return data;
  }, csv);
  await page
    .getByRole("button", { name: "Upload dataset", exact: true })
    .dispatchEvent("drop", { dataTransfer });
  await expect(
    page.getByRole("heading", { name: "dropped", exact: true }),
  ).toBeVisible();
});

test("real Excel upload, computed statistics, models and HTML report", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page
    .getByLabel("Dataset file")
    .setInputFiles("tests/fixtures/upload.xlsx");
  await page
    .getByLabel("Analysis target", { exact: true })
    .selectOption("target");
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  await expect(
    page.getByRole("tab", { name: "Statistics", exact: true }),
  ).toBeVisible({ timeout: 150_000 });
  await page.getByRole("tab", { name: "Statistics", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("measurement");
  await expect(page.getByRole("tabpanel")).toContainText("-0.5");
  await page
    .getByRole("tab", { name: "Machine Learning", exact: true })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText("Dummy Regressor");
  await expect(page.getByRole("tabpanel")).toContainText("RMSE");
  await page.getByRole("tab", { name: "Report", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .HTML", exact: true })
    .click();
  const content = await fs.readFile((await (await pending).path())!, "utf8");
  expect(content).toContain("Aritra Saha");
  expect(content).toContain("measurement");
  await noOverflow(page);
});

test("error: independent browser sessions cannot access another dataset", async ({
  page,
  browser,
}) => {
  await page.goto("/dashboard");
  const analysisRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/analyze") && request.method() === "POST",
  );
  await page.getByLabel("Dataset file").setInputFiles({
    name: "owner.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByLabel("Analysis target", { exact: true })
    .selectOption("target");
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  const request = await analysisRequest;
  const api = new URL(request.url()).origin;
  expect(api).toBe(process.env.INFERA_E2E_API_URL || "http://127.0.0.1:8001");
  const datasetId = request.postDataJSON().dataset_id;
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible({ timeout: 150_000 });
  const other = await browser.newContext({
    baseURL: process.env.INFERA_E2E_BASE_URL || "http://127.0.0.1:3100",
  });
  try {
    const second = await other.newPage();
    await second.goto("/dashboard");
    await second.getByLabel("Dataset file").setInputFiles({
      name: "other.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await expect(
      second.getByRole("button", { name: "Launch Full Analysis" }),
    ).toBeVisible();
    const denied = await second.evaluate(
      async ({ api, datasetId }) => {
        const headers = {
          "X-Infera-Session": sessionStorage.getItem("infera-session")!,
          "Content-Type": "application/json",
        };
        const statuses = [];
        for (const path of [
          `/api/results/${datasetId}`,
          `/api/results/${datasetId}/report?format=html`,
          "/api/analyze",
        ]) {
          const response = await fetch(api + path, {
            headers,
            method: path === "/api/analyze" ? "POST" : "GET",
            ...(path === "/api/analyze"
              ? {
                  body: JSON.stringify({
                    dataset_id: datasetId,
                    target_column: "target",
                  }),
                }
              : {}),
          });
          statuses.push(response.status);
        }
        return statuses;
      },
      { api, datasetId },
    );
    expect(denied).toEqual([404, 404, 404]);
    const own = await page.evaluate(
      async ({ api, datasetId }) =>
        (
          await fetch(`${api}/api/results/${datasetId}`, {
            headers: {
              "X-Infera-Session": sessionStorage.getItem("infera-session")!,
            },
          })
        ).status,
      { api, datasetId },
    );
    expect(own).toBe(200);
  } finally {
    await other.close();
  }
});

for (const [sample, expected] of [
  ["Telecom Customer Churn", "Macro F1"],
  ["Student Exam Performance", "Macro F1"],
  ["Weekly Retail Sales", "Time-series Diagnostics"],
]) {
  test(`real ${sample} analysis`, async ({ page }) => {
    await analyze(page, sample);
    await page
      .getByRole("tab", { name: "Machine Learning", exact: true })
      .click();
    await expect(page.getByRole("tabpanel")).toContainText(expected);
    if (expected === "Macro F1")
      await expect(page.getByRole("tabpanel")).toContainText("Confusion");
    await noOverflow(page);
  });
}

test("invalid and empty uploads allow retry", async ({ page }) => {
  await page.goto("/dashboard");
  for (const [name, content, expected] of [
    ["bad.exe", "binary", "Unsupported"],
    ["empty.csv", "", "empty"],
  ]) {
    await page.getByLabel("Dataset file").setInputFiles({
      name,
      mimeType: "application/octet-stream",
      buffer: Buffer.from(content),
    });
    await expect(page.getByRole("alert").first()).toContainText(expected, {
      ignoreCase: true,
    });
  }
  await page.getByLabel("Dataset file").setInputFiles({
    name: "valid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByRole("button", { name: "Launch Full Analysis" }),
  ).toBeVisible();
});

test("error: unavailable backend message and safe catalog retry", async ({
  page,
}) => {
  await page.route("**/api/samples", (route) =>
    route.fulfill({
      status: 503,
      contentType: "text/html",
      body: "Upstream unavailable",
    }),
  );
  await page.goto("/dashboard");
  await expect(
    page.getByRole("alert").filter({ hasText: "starting" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "starting" }),
  ).not.toContainText("dataset is invalid");
  await page.unroute("**/api/samples");
  await page.getByRole("button", { name: "Retry sample catalog" }).click();
  await expect(
    page.getByRole("button", { name: /Housing Prices/ }),
  ).toBeVisible();
});

test("error: invalid API response is contained", async ({ page }) => {
  await page.route("**/api/samples", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"wrong":"shape"}',
    }),
  );
  await page.goto("/dashboard");
  await expect(
    page.getByRole("alert").filter({ hasText: "invalid response" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload dataset", exact: true }),
  ).toBeVisible();
});

test("real insufficient dataset explains why modeling is unavailable", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const content =
    "feature,target,missing\n-4,8.5,\n-3,6.5,\n-2,4.5,\n-1,2.5,\n0,0.5,\n1,-2.5,";
  await page.getByLabel("Dataset file").setInputFiles({
    name: "small.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await page
    .getByLabel("Analysis target", { exact: true })
    .selectOption("target");
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Machine Learning", exact: true })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Insufficient sample size",
  );
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
});

test("existing mark is used by browser icons and website metadata", async ({
  page,
  request,
}) => {
  await page.goto("/about");
  const iconLinks = await page
    .locator('link[rel="icon"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") || ""),
    );
  expect(iconLinks.some((url) => url.includes("favicon.ico"))).toBe(true);
  expect(iconLinks.some((url) => url.includes("icon.svg"))).toBe(true);
  for (const path of [
    "/favicon.ico",
    "/icon.svg",
    "/apple-icon.png",
    "/infera-icon.svg",
    "/infera-icon.png",
  ]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://infera-omega.vercel.app/infera-icon.png",
  );
  await expect(
    page.locator('header img[src="/infera-icon.svg"]').first(),
  ).toBeVisible();
});

test("real skewed CSV with large values, missing data, and unavailable correlation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/dashboard");
  const content =
    "small,large,constant\n" +
    Array.from(
      { length: 40 },
      (_, i) =>
        `${i < 20 ? i - 10 : ""},${i >= 20 ? (i === 39 ? 1e12 : i) : ""},5`,
    ).join("\n");
  await page.getByLabel("Dataset file").setInputFiles({
    name: "skewed.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  await expect(
    page.getByRole("tab", { name: "Explore", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await page.getByLabel("Numerical feature").selectOption("large");
  await expect(page.getByRole("tabpanel")).toContainText("right-skewed");
  await expect(page.getByRole("tabpanel")).toContainText("N/A");
  await page.getByLabel("Correlation method").selectOption("spearman");
  await expect(
    page.getByRole("heading", { name: "Spearman Correlation Matrix" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("tab", { name: "Data Quality", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("50");
  await noOverflow(page);
});
