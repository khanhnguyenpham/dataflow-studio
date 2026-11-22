import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("review rules show actionable failures and the workspace adapts to six screen sizes", async ({
  page,
}) => {
  await page.goto("/#mapping");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My datasets", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clean & export", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Operation", exact: true })
    .selectOption("validate");
  await page
    .getByRole("combobox", { name: "Column", exact: true })
    .selectOption("Quantity");
  await page
    .getByRole("combobox", { name: "Validation rule", exact: true })
    .selectOption("number");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Quantity");
  await expect(page.getByRole("alert")).toContainText("2 rows did not pass");
  await expect(page.getByRole("alert")).toContainText("5, 6");
  // A failed check does not create an applied version or expose an apply action.
  await expect(
    page.getByRole("button", { name: "Confirm and save version" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Data quality", exact: true }).click();
  await expect(
    page.getByText(/statistical warning, not a confirmed error/).first(),
  ).toBeVisible();
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole("button", { name: "My datasets", exact: true }),
    ).toBeVisible();
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
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    if (width === 768)
      await page.screenshot({
        path: "../docs/images/release-tablet.png",
        fullPage: true,
      });
  }
});
