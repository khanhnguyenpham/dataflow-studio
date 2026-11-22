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
    vi.fn().mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === "/api/config"
              ? { upload_max_bytes: 5242880, max_rows: 10000, max_columns: 100 }
              : { code: "unauthorized" },
          ),
          {
            status: url === "/api/config" ? 200 : 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
    ),
  );
  render(<App />);
  expect(
    await screen.findByRole("heading", {
      name: "Turn monthly spreadsheets into a repeatable report.",
    }),
  ).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "vi" },
  });
  expect(
    await screen.findByRole("heading", {
      name: "Từ bảng tính mỗi tháng đến quy trình báo cáo dùng lại.",
    }),
  ).toBeVisible();
});
