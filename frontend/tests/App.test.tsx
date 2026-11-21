import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App";
import i18n from "../src/i18n";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("welcome recovers from an unavailable session and switches locale", async () => {
  await i18n.changeLanguage("en");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
  );
  render(<App />);
  expect(
    await screen.findByRole("heading", {
      name: "Understand your data before changing it.",
    }),
  ).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "vi" },
  });
  expect(
    await screen.findByRole("heading", {
      name: "Hiểu dữ liệu trước khi thay đổi.",
    }),
  ).toBeVisible();
});
