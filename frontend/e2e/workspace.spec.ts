import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("analytics rejects invalid numbers and exports a pinned cleaned report", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  const source = await page
    .getByRole("combobox", { name: "My datasets" })
    .inputValue();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Dataset version", exact: true })
    .selectOption(source);
  await page
    .getByRole("combobox", { name: "Group by", exact: true })
    .selectOption("Product Code");
  await page
    .getByRole("combobox", { name: "Calculation", exact: true })
    .selectOption("sum");
  await page
    .getByRole("combobox", { name: "Numeric column", exact: true })
    .selectOption("Quantity");
  await page
    .getByRole("checkbox", {
      name: "I have reviewed version 1 for this analysis.",
    })
    .check();
  await page
    .getByRole("button", { name: "Calculate preview", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "not valid normalized numbers",
  );
  await expect(page.getByRole("img")).toHaveCount(0);
  await page.getByRole("button", { name: "My datasets", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sample dataset" })
    .selectOption("next-month");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "next-month-sales.csv" }),
  ).toBeVisible();
  const next = await page
    .getByRole("combobox", { name: "My datasets" })
    .inputValue();
  await page
    .getByRole("button", { name: "Clean & export", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Operation", exact: true })
    .selectOption("dedupe");
  await page
    .getByRole("listbox", { name: "Columns", exact: true })
    .selectOption("Order ID");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirm and save version", exact: true })
    .click();
  await expect(page.getByLabel("I want to export version 2.")).toBeVisible();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Dataset version", exact: true })
    .selectOption(next);
  await page
    .getByRole("combobox", { name: "Group by", exact: true })
    .selectOption("Product Code");
  await page
    .getByRole("combobox", { name: "Calculation", exact: true })
    .selectOption("sum");
  await page
    .getByRole("combobox", { name: "Numeric column", exact: true })
    .selectOption("Quantity");
  await page
    .getByRole("checkbox", {
      name: "I have reviewed version 2 for this analysis.",
    })
    .check();
  await page
    .getByRole("button", { name: "Calculate preview", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Calculated metrics" })
      .getByText("12", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Chart type", exact: true })
    .selectOption("pie");
  await page
    .getByRole("button", { name: "Calculate preview", exact: true })
    .click();
  await expect(page.locator("svg.data-chart path")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Chart type", exact: true })
    .selectOption("line");
  await page
    .getByRole("combobox", { name: "Group by", exact: true })
    .selectOption("Order Date");
  await page
    .getByRole("button", { name: "Calculate preview", exact: true })
    .click();
  await expect(page.locator("svg.data-chart polyline")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Chart type", exact: true })
    .selectOption("bar");
  await page
    .getByRole("combobox", { name: "Group by", exact: true })
    .selectOption("Product Code");
  await page
    .getByRole("button", { name: "Calculate preview", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Report name", exact: true })
    .fill("November quantities");
  await page
    .getByRole("button", { name: "Save calculation as workflow", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Calculation saved as a workflow",
  );
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "November quantities", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/images/analytics-report.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "File format", exact: true })
    .selectOption("json");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download file", exact: true })
    .click();
  const file = await downloadPromise,
    savedPath = await file.path();
  expect(savedPath).toBeTruthy();
  const exported = JSON.parse(await readFile(savedPath!, "utf8"));
  expect(exported.dataset_version).toBe(2);
  expect(exported.result.metrics.overall).toBe("12");
  await page.getByRole("button", { name: "Workflows", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Select a workflow" })
    .selectOption({ label: "November quantities · v1" });
  await page
    .getByRole("combobox", { name: "Source dataset", exact: true })
    .selectOption(next);
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "sum(Quantity)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "6", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("vi");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("monthly workflow joins lookup data and runs again on a new month", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  const source = await page
    .getByRole("combobox", { name: "My datasets" })
    .inputValue();
  await page
    .getByRole("combobox", { name: "Sample dataset" })
    .selectOption("products");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "products.csv" }),
  ).toBeVisible();
  const lookup = await page
    .getByRole("combobox", { name: "My datasets" })
    .inputValue();
  await page
    .getByRole("combobox", { name: "Sample dataset" })
    .selectOption("next-month");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "next-month-sales.csv" }),
  ).toBeVisible();
  const next = await page
    .getByRole("combobox", { name: "My datasets" })
    .inputValue();
  await page
    .getByRole("combobox", { name: "My datasets" })
    .selectOption(source);
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clean & export", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Operation", exact: true })
    .selectOption("dedupe");
  await page
    .getByRole("listbox", { name: "Columns", exact: true })
    .selectOption("Order ID");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByText("Save a reusable workflow", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Workflow name", exact: true })
    .fill("Monthly report");
  await page
    .getByRole("combobox", { name: "Combine with another dataset" })
    .selectOption("left");
  await page
    .getByRole("combobox", { name: "Lookup / second dataset" })
    .selectOption(lookup);
  await page
    .getByRole("combobox", { name: "Source key after cleaning" })
    .selectOption("Product Code");
  await page
    .getByRole("combobox", { name: "Lookup key", exact: true })
    .selectOption("Product Code");
  await page
    .getByRole("button", { name: "Save workflow", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Workflow saved.");
  await page.getByRole("button", { name: "Workflows", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Select a workflow" })
    .selectOption({ label: "Monthly report · v1" });
  await page
    .getByRole("combobox", { name: "Source dataset", exact: true })
    .selectOption(source);
  await page
    .getByRole("combobox", { name: "Lookup / second dataset" })
    .selectOption(lookup);
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByText("Source: 6 rows · Result: 5 rows", { exact: true }),
  ).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirm and save version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Run result preview" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Source dataset", exact: true })
    .selectOption(next);
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByText("Source: 4 rows · Result: 3 rows", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Travel Notebook", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/images/workflow-result.png",
    fullPage: true,
  });
  await page.getByRole("combobox", { name: "Language" }).selectOption("vi");
  await expect(
    page.getByRole("heading", { name: "Xem trước kết quả chạy" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("guest inspects real parsed sample and can change language", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "001", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "../docs/images/workspace-desktop.png" });
  await page.getByRole("button", { name: "Data quality", exact: true }).click();
  await expect(
    page.getByText("Data is never changed automatically.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quantity", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("vi");
  await expect(
    page.getByRole("heading", { name: "Chất lượng dữ liệu", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("preview cleaning, apply, export and restore the source", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clean & export", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Operation", exact: true })
    .selectOption("dedupe");
  await page
    .getByRole("listbox", { name: "Columns", exact: true })
    .selectOption("Order ID");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "After 5 Rows" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/images/cleaning-preview.png",
    fullPage: true,
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirm and save version", exact: true })
    .click();
  await expect(
    page.getByText("Version 2", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toBeVisible();
  await page.getByLabel("I want to export version 2.").check();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download file", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toBe("dataflow-v2.xlsx");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByLabel("I want to export version 1.")).toBeVisible();
  await page.getByRole("button", { name: "My datasets", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "002", exact: true }),
  ).toHaveCount(2);
});
test("mobile workspace uses row details without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  await page.getByText("Row 1 · 001", { exact: true }).click();
  await expect(
    page.locator(".mobile-records").getByText("2026-10-01", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/images/workspace-mobile.png",
    fullPage: true,
  });
});
