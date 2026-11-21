import { test, expect } from "@playwright/test";
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
