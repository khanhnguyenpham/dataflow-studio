import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("workspace home uses real totals, keeps dataset context and opens a version-pinned report", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Turn monthly spreadsheets into a repeatable report.",
    }),
  ).toBeVisible();
  const welcomeAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    welcomeAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "../docs/images/product-welcome.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const stats = page.getByRole("region", { name: "Your workspace totals" });
  await expect(
    stats.locator("article").filter({ hasText: "Datasets" }).locator("strong"),
  ).toHaveText("1");
  await expect(
    stats
      .locator("article")
      .filter({ hasText: "Saved reports" })
      .locator("strong"),
  ).toHaveText("0");
  await page
    .getByRole("button", { name: "View workflows", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create a workflow", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Clean & export", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Workflow name", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Inspect monthly-sales-sample.csv",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Data quality", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Step 4: Analytics", exact: true })
    .click();
  const input = page.getByRole("combobox", {
    name: "Dataset version",
    exact: true,
  });
  await expect(input).not.toHaveValue("");
  await page
    .getByRole("combobox", { name: "Group by", exact: true })
    .selectOption("Product Code");
  await page
    .getByRole("checkbox", {
      name: "I have reviewed version 1 for this analysis.",
    })
    .check();
  await page
    .getByRole("button", { name: "Calculate preview", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Report name", exact: true })
    .fill("Monthly order count");
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Monthly order count", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    stats
      .locator("article")
      .filter({ hasText: "Saved reports" })
      .locator("strong"),
  ).toHaveText("1");
  await page
    .getByRole("button", {
      name: "View report Monthly order count",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Monthly order count", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Pinned to dataset version 1. Later cleaning or restore does not change this report.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  for (const width of [360, 390, 430, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    if (width === 390 || width === 1366)
      await page.screenshot({
        path: `../docs/images/product-overview-${width}.png`,
        fullPage: true,
      });
  }
  await page.getByRole("combobox", { name: "Language" }).selectOption("vi");
  await expect(
    page.getByRole("heading", { name: "Tổng quan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xem báo cáo Monthly order count" }),
  ).toBeVisible();
});
