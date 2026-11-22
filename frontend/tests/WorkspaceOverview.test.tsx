import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WorkspaceOverview from "../src/WorkspaceOverview";
import i18n from "../src/i18n";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("unavailable overview shows an error and retries rather than inventing zero counts", async () => {
  await i18n.changeLanguage("en");
  let attempt = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      attempt++;
      return new Response(
        JSON.stringify(
          attempt === 1
            ? { code: "database_unavailable" }
            : {
                counts: { datasets: 0, workflows: 0, reports: 0, runs: 0 },
                datasets: [],
                reports: [],
                runs: [],
              },
        ),
        {
          status: attempt === 1 ? 503 : 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }),
  );
  const importData = vi.fn();
  render(
    <WorkspaceOverview
      openDataset={vi.fn()}
      openWorkflow={vi.fn()}
      openReport={vi.fn()}
      navigate={vi.fn()}
      importData={importData}
    />,
  );
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(
    screen.queryByRole("region", { name: "Your workspace totals" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("region", { name: "Your workspace totals" }),
  ).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "Import data" })[0]);
  expect(importData).toHaveBeenCalledOnce();
});
