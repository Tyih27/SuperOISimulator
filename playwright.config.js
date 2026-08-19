import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  webServer: { command: "node e2e/serve.mjs", port: 4173, reuseExistingServer: true },
  use: { baseURL: "http://127.0.0.1:4173" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true } },
  ],
});
