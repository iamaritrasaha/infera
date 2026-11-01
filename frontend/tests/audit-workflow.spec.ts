import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("audited local CSV workflow, regression, explorer and downloads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/dashboard");
  const csv = "x,target,group,empty\n" + Array.from({ length: 30 }, (_, i) => `${i},${2*i+1},${i%2 ? "A" : "B"},`).join("\n");
  await page.getByLabel("Dataset file").setInputFiles({ name: "audit.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByLabel("Analysis target", { exact: true }).selectOption("target");
  const pending = page.waitForResponse(r => r.url().endsWith("/api/analyze"));
  await page.getByRole("button", { name: "Launch Full Analysis" }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "What this data contains" })).toBeVisible();
  const datasetId = response.request().postDataJSON().dataset_id;
  const owner = await page.evaluate(() => sessionStorage.getItem("infera-session")!);
  const cached = await page.request.get(`${new URL(response.url()).origin}/api/results/${datasetId}`, { headers: { "X-Infera-Session": owner } });
  expect(cached.status()).toBe(200);
  const data = await cached.json();
  expect(data.modeling.models.find((m: { model_name: string }) => m.model_name === "linear_regression").r2_test).toBe(1);
  await expect(page.getByRole("heading", { name: "What this data contains" })).toBeVisible();
  for (const tab of ["Data Quality", "Statistics", "Machine Learning", "Statistical Evidence", "Explore", "Report"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(page.getByText("This view could not render.")).toHaveCount(0);
    if (tab === "Statistics") await expect(page.getByRole("tabpanel")).toContainText("Unavailable");
    if (tab === "Machine Learning") {
      await expect(page.getByRole("tabpanel")).toContainText("RMSE");
      await expect(page.getByRole("tabpanel")).toContainText("not implemented");
    }
  }
  for (const [label, text] of [["Download .MD", "INFERA DATA SCIENCE EVIDENCE REPORT"], ["Download .HTML", "<!DOCTYPE html>"]]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(await fs.readFile((await (await download).path())!, "utf8")).toContain(text);
  }
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  const run = page.waitForResponse(r => r.url().endsWith("/api/explore") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Run exploration", exact: true }).click();
  expect((await run).status()).toBe(200);
  expect(errors).toEqual([]);
});
