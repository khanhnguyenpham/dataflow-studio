import { defineConfig } from "@playwright/test";
const database = process.env.E2E_DATABASE_URL;
if (!database || new URL(database).pathname !== "/dataflow_e2e" || !["localhost","127.0.0.1"].includes(new URL(database).hostname))
  throw new Error(
    "Set E2E_DATABASE_URL to the dedicated dataflow_e2e database.",
  );
const port = process.env.E2E_PORT || "9001";
const baseURL = `http://127.0.0.1:${port}`;
const python = process.env.DATAFLOW_PYTHON || "python";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    locale: "en-US",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `"${python}" -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    env: {
      PYTHONPATH: "../backend",
      COOKIE_SECURE: "false",
      APP_ORIGINS: baseURL,
      DATABASE_URL: database,
    },
  },
});
