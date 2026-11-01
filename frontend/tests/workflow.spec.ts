import { test, expect } from "@playwright/test";

test.describe("Infera End-to-End Workflow", () => {
  test("loads sample dataset, renders stats, correlations, trains linear regression, and verifies chart", async ({
    page,
  }) => {
    // 1. Visit main page
    await page.goto("/");
    await expect(page).toHaveTitle(/Infera/);
    await expect(
      page.getByRole("heading", { name: /Turn Data Into Evidence/i })
    ).toBeVisible();

    // 2. Click Load Sample Dataset
    const sampleBtn = page.getByRole("button", {
      name: /Load Sample Housing Dataset/i,
    });
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // 3. Verify Results Header and Total Rows
    await expect(page.getByText("sample_housing.csv")).toBeVisible();
    await expect(page.getByTestId("total-rows")).toContainText("120");

    // 4. Verify Preview Table & Descriptive Statistics
    await expect(
      page.getByRole("heading", { name: /Data Preview & Columns/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Descriptive Statistics/i })
    ).toBeVisible();

    // 5. Verify Correlation Section
    await expect(
      page.getByRole("heading", { name: /Pearson Correlation Analysis/i })
    ).toBeVisible();

    // 6. Train Linear Regression Model
    const trainBtn = page.getByRole("button", { name: /Train Model/i });
    await expect(trainBtn).toBeVisible();
    await trainBtn.click();

    // 7. Verify Regression Metrics & Chart
    await expect(page.getByText(/Test R² Score/i)).toBeVisible();
    await expect(page.getByText(/Mean Abs Error/i)).toBeVisible();
    await expect(page.getByText(/Actual vs\. Predicted/i)).toBeVisible();

    // 8. Verify Report Download Button
    const reportLink = page.getByRole("link", {
      name: /Download Report/i,
    });
    await expect(reportLink).toBeVisible();
    const href = await reportLink.getAttribute("href");
    expect(href).toContain("/api/report/");
  });

  test("uploads a custom CSV and displays results", async ({ page }) => {
    await page.goto("/");

    // Create a buffer for a small test CSV
    const csvContent =
      "area,bedrooms,price\n1000,2,200000\n1500,3,300000\n2000,4,400000\n2500,4,500000\n1200,2,240000\n1800,3,360000\n2200,4,440000\n1100,2,220000\n1600,3,320000\n2100,4,420000\n1300,3,260000\n1900,4,380000\n";

    // Upload via file input
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("input[type=file]").evaluate((input: HTMLInputElement) => input.click());
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "custom_houses.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });

    // Verify dataset uploaded and displayed
    await expect(page.getByText("custom_houses.csv")).toBeVisible();
    await expect(page.getByTestId("total-rows")).toContainText("12");
  });
});
