import { expect, test, type Download } from "@playwright/test";

const csv = ["when,revenue,other,region", ...Array.from({ length: 40 }, (_, i) => {
  const date = new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10);
  const region = i < 20 ? "north" : "south";
  const revenue = i < 20 ? 10 + i : 100 + i;
  return `${date},${revenue},${i * 2 + 1},${region}`;
})].join("\n");

async function downloadContents(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("The browser did not expose the downloaded file.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

test("filtered group and trend calculations can be saved as a private browser snapshot", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Dataset file").setInputFiles({
    name: "dated-regional-results.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const analysisResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/analyze") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  const analysisResponse = await analysisResponsePromise;
  expect(analysisResponse.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "What this data contains" })).toBeVisible({ timeout: 150_000 });

  const findingCard = page.locator("article").filter({ hasText: "Recorded revenue differs across region" });
  await findingCard.getByRole("button", { name: "Explore this finding" }).click();
  await expect(page.getByText(/Finding controls loaded from its evidence/)).toBeVisible();
  await expect(page.getByLabel("Exploration metric")).toHaveValue("revenue");
  await expect(page.getByLabel("Group column")).toHaveValue("region");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();

  await page.getByRole("button", { name: "Save analysis to this browser" }).click();
  await page.getByLabel("Analysis title").fill("Regional trend check");
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByText(/Saved in this browser\. Return/)).toBeVisible();
  const saved = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("infera-browser-snapshots", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = database.transaction("analyses", "readonly").objectStore("analyses").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return rows[0];
  });
  expect(saved).toBeTruthy();
  expect(saved).not.toHaveProperty("dataset_id");
  expect(saved).not.toHaveProperty("preview_rows");
  expect(JSON.stringify(saved)).not.toContain("infera-session");
  const snapshotSchema = saved.analysis as { schema: { columns: Record<string, unknown>[] } };
  expect(snapshotSchema.schema.columns.every((column) => !("sample_values" in column))).toBe(true);

  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Interactive Data Explorer" })).toBeVisible();
  const groupQuestion = page.getByRole("button", { name: /revenue.*vary across.*region/i });
  const groupResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/explore") && response.request().method() === "POST");
  await groupQuestion.click();
  const groupResponse = await groupResponsePromise;
  expect(groupResponse.status()).toBe(200);
  const groupTable = page.getByRole("table").filter({ hasText: "Sample size" });
  await expect(groupTable).toContainText("19.5");
  await expect(groupTable).toContainText("129.5");

  await page.getByRole("button", { name: "Add filter" }).click();
  const optionsPromise = page.waitForResponse((response) => response.url().endsWith("/api/explore/options"));
  await page.getByLabel("Filter column").selectOption("region");
  expect((await optionsPromise).status()).toBe(200);
  await page.getByLabel("Values to include for region").selectOption("north");
  const filteredResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/explore") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Apply filters" }).click();
  const filteredResponse = await filteredResponsePromise;
  expect(filteredResponse.status()).toBe(200);
  await expect(groupTable).toContainText("north");
  await expect(groupTable).toContainText("19.5");
  await expect(groupTable).toContainText("20");
  await expect(page.getByText(/20 of 40 rows matched the filters/)).toBeVisible();
  const [aggregateDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download aggregate CSV" }).click(),
  ]);
  const aggregateCsv = await downloadContents(aggregateDownload);
  expect(aggregateCsv).toContain('"group","median","sample_size"');
  expect(aggregateCsv).toContain('"north","19.5","20"');
  expect(aggregateCsv.trim().split(/\r?\n/)).toHaveLength(2);

  const clearResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/explore") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Clear filters" }).click();
  const clearedResponse = await clearResponsePromise;
  expect(clearedResponse.status()).toBe(200);
  await expect(page.getByText(/40 of 40 rows matched the filters/)).toBeVisible();

  await page.getByRole("button", { name: "Add filter" }).click();
  const reapplyOptionsPromise = page.waitForResponse((response) => response.url().endsWith("/api/explore/options"));
  await page.getByLabel("Filter column").selectOption("region");
  expect((await reapplyOptionsPromise).status()).toBe(200);
  await page.getByLabel("Values to include for region").selectOption("north");
  const reapplyResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/explore") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Apply filters" }).click();
  expect((await reapplyResponsePromise).status()).toBe(200);

  await page.getByRole("tab", { name: "Report", exact: true }).click();
  const reportPreview = page.locator(".evidence-report pre");
  await expect(reportPreview).toContainText("Interactive exploration");
  await expect(reportPreview).toContainText("region includes north");
  await expect(reportPreview).toContainText("20 of 40 matched the filters");
  const [htmlReport] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download .HTML" }).click(),
  ]);
  const htmlContents = await downloadContents(htmlReport);
  expect(htmlContents).toContain("Interactive exploration");
  expect(htmlContents).toContain("region includes north");
  expect(htmlContents).not.toContain("<script>");

  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await page.getByRole("tab", { name: "Trend explorer" }).click();
  await expect(page.getByLabel("Trend period")).toBeEnabled();
  await page.getByLabel("Trend period").selectOption("D");
  const trendResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/explore") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run exploration" }).click();
  const trendResponse = await trendResponsePromise;
  expect(trendResponse.status()).toBe(200);
  const trendTable = page.getByRole("table").filter({ hasText: "Period" });
  await expect(trendTable).toContainText("2025-01-01");
  await expect(trendTable).toContainText("2025-02-09");
  await expect(trendTable).toContainText("139");
  await expect(page.getByText("First to last change", { exact: true }).locator("xpath=..")).toContainText("129");
  await expect(page.getByRole("button", { name: "Download period CSV" })).toBeVisible();

  await page.getByRole("button", { name: "Choose another dataset" }).click();
  await page.getByRole("button", { name: "Regional trend check", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Regional trend check" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("saved computation");
  await expect(page.getByRole("heading", { name: "Key findings" })).toBeVisible();
  await page.getByRole("button", { name: "Back to workspace" }).click();
  await page.getByRole("button", { name: "Delete saved analysis Regional trend check" }).click();
  await expect(page.getByText("No saved analyses yet.")).toBeVisible();
});
