import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4179",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      use: {
        viewport: { width: 820, height: 1180 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: [
    {
      command: "node --import tsx tests/fixtures/start.ts",
      url: "http://127.0.0.1:54329/__health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:4179",
      reuseExistingServer: false,
      env: {
        SUPABASE_URL: "http://127.0.0.1:54329",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_only",
        SUPABASE_SECRET_KEY: "sb_secret_e2e_only",
        PORT: "3129",
        WEB_PORT: "4179",
        APP_ORIGIN: "http://127.0.0.1:4179",
        RECOMMENDATION_MODE: "demo",
        TRYON_MODE: "demo",
      },
    },
  ],
});
