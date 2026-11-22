import { test, expect } from "@playwright/test";

test("recipe survives navigation but needs a new preview; revocation clears identity state", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await page.getByRole("button", { name: "My datasets", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "monthly-sales-sample.csv" }),
  ).toBeVisible();
  const source = await page
    .getByRole("combobox", { name: "My datasets", exact: true })
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
  await expect(
    page.getByRole("button", { name: "Confirm and save version", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page
    .getByRole("button", { name: "Clean & export", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove step 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm and save version", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "My datasets", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sample dataset", exact: true })
    .selectOption("products");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await page
    .getByRole("button", { name: "Clean & export", exact: true })
    .click();
  await expect(
    page.getByText("No steps yet. Changes are never applied automatically."),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "My datasets", exact: true })
    .selectOption(source);
  await expect(
    page.getByRole("button", { name: "Remove step 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Confirm and save version", exact: true })
    .click();
  await expect(page.getByLabel("I want to export version 2.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove step 1", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Operation", exact: true })
    .selectOption("trim");
  await page
    .getByRole("listbox", { name: "Columns", exact: true })
    .selectOption("Product Code");
  await page.getByRole("button", { name: "Add step", exact: true }).click();

  // A real server-side revocation, not a mocked response or a UI-only sign-out.
  const session = await page.request.get("/api/auth/session");
  const { csrf } = await session.json();
  const revoked = await page.request.post("/api/auth/logout", {
    headers: { "X-CSRF-Token": csrf },
  });
  expect(revoked.ok()).toBe(true);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Turn monthly spreadsheets into a repeatable report.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Your session has ended.",
  );
  await expect(
    page.getByRole("navigation", { name: "Workspace", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Try a private workspace" }).click();
  await page
    .getByRole("button", { name: "Clean & export", exact: true })
    .click();
  await expect(
    page.getByText("No steps yet. Changes are never applied automatically."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm and save version", exact: true }),
  ).toHaveCount(0);
});
