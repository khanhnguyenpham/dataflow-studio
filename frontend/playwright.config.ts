import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:9001",
    locale: "en-US",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 9001",
    url: "http://127.0.0.1:9001/api/health",
    reuseExistingServer: !process.env.CI,
    env: {
      PYTHONPATH: "../backend",
      COOKIE_SECURE: "false",
      APP_ORIGINS: "http://127.0.0.1:9001",
    },
  },
});
