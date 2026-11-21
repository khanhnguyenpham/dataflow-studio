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
    page.getByText("No values have been changed.", { exact: false }),
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
