import { test, expect } from "@playwright/test";

test("review a changed schema, preserve the source and run the saved workflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await page.getByRole("button", { name: "My datasets", exact: true }).click();
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
    .fill("Header review");
  await page
    .getByRole("button", { name: "Save workflow", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Workflow saved.");
  await page.getByRole("button", { name: "My datasets", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sample dataset" })
    .selectOption("variant");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "next-month-variant.csv" }),
  ).toBeVisible();
  const input = await page
    .getByRole("combobox", { name: "My datasets" })
    .inputValue();
  await page.getByRole("button", { name: "Workflows", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Select a workflow" })
    .selectOption({ label: "Header review · v1" });
  await page
    .getByRole("combobox", { name: "Source dataset", exact: true })
    .selectOption(input);
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("input columns changed");
  await page.getByText("Check and align column names", { exact: true }).click();
  await page
    .getByRole("button", { name: "Suggest matching columns", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", {
      name: "Input column for Quantity",
      exact: true,
    }),
  ).toHaveValue("qty");
  await expect(
    page.getByRole("button", { name: "Preview column alignment", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "Remove these extra columns from the derived version.",
      exact: false,
    })
    .check();
  await page
    .getByRole("button", { name: "Preview column alignment", exact: true })
    .click();
  await expect(
    page.locator(".mapping-preview").getByRole("columnheader").first(),
  ).toHaveText("Order ID");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirm column alignment", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Column changes saved");
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByText("Source: 4 rows · Result: 3 rows", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("vi");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
