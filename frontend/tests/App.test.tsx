import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import App from "../src/App";
import i18n from "../src/i18n";
import { api, setSessionAuthenticated } from "../src/api";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setSessionAuthenticated(false);
});

test("revoked sessions close the workspace and explain how to return", async () => {
  await i18n.changeLanguage("en");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === "/api/auth/session"
              ? {
                  user: {
                    id: "owner",
                    username: "test",
                    role: "user",
                    expires_at: null,
                  },
                  csrf: "test-token",
                }
              : url === "/api/config"
                ? {
                    upload_max_bytes: 5242880,
                    max_rows: 10000,
                    max_columns: 100,
                  }
                : url === "/api/datasets"
                  ? { items: [] }
                  : url === "/api/overview"
                    ? {
                        counts: {
                          datasets: 0,
                          workflows: 0,
                          reports: 0,
                          runs: 0,
                        },
                        datasets: [],
                        reports: [],
                        runs: [],
                      }
                    : { code: "unauthorized" },
          ),
          { status: url === "/api/revoked" ? 401 : 200 },
        ),
    ),
  );
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await act(async () => {
    await api("/revoked").catch(() => undefined);
  });
  expect(
    await screen.findByRole("heading", {
      name: "Turn monthly spreadsheets into a repeatable report.",
    }),
  ).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Your session has ended.",
  );
  expect(
    screen.queryByRole("navigation", { name: "Workspace" }),
  ).not.toBeInTheDocument();
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
