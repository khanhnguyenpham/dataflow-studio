import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({trace:"off"});

test("administrator creates an account, enforces access and reviews limits/audit", async ({
  page,
}) => {
  const credentials = JSON.parse(
    await readFile("../.runtime/browser-admin.json", "utf8"),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Username", exact: true })
    .fill(credentials.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page
    .locator(".login-form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Accounts", exact: true }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Create account$/ })
    .click();
  await page
    .locator(".admin-create")
    .getByRole("textbox", { name: "Username", exact: true })
    .fill(credentials.target_username);
  await page
    .locator(".admin-create")
    .getByLabel("New password (12–128 characters)")
    .fill(credentials.target_password);
  await page
    .locator(".admin-create")
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: credentials.target_username, exact: true }),
  ).toBeVisible();
  const row = page
    .getByRole("row")
    .filter({
      has: page.getByRole("cell", {
        name: credentials.target_username,
        exact: true,
      }),
    });
  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("checkbox").uncheck();
  await row.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(row.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button", { name: "Usage limits", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Concurrent guest workspaces",
      exact: true,
    }),
  ).toHaveValue("20");
  await page
    .getByRole("spinbutton", { name: "Guest datasets", exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Save limits", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Changes saved.");
  await page
    .getByRole("spinbutton", { name: "Guest datasets", exact: true })
    .fill("3");
  await page.getByRole("button", { name: "Save limits", exact: true }).click();
  await page.getByRole("button", { name: "Activity log", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Account access changed", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/images/administration.png",
    fullPage: true,
  });
  await page.getByRole("combobox", { name: "Language" }).selectOption("vi");
  await expect(
    page.getByRole("heading", { name: "Nhật ký hoạt động", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
