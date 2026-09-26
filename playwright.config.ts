import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
process.env.E2E_ADMIN_PASSWORD ||= randomBytes(24).toString("hex");
if (!process.env.E2E_DATA_DIR) {
  const directory = path.resolve(".runtime", `e2e-${randomBytes(8).toString("hex")}`);
  process.env.E2E_DATA_DIR = directory;
  mkdirSync(path.join(directory, "raw"), { recursive: true });
  mkdirSync(path.join(directory, "generated"));
  for (const name of readdirSync("data/raw")) {
    if (/^\d{2}-[a-z]+\.md$/.test(name)) copyFileSync(path.join("data/raw", name), path.join(directory, "raw", name));
  }
  copyFileSync("tests/fixtures/snapshot.json", path.join(directory, "generated/snapshot.json"));
}
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } }, { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel: "chrome" } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    env: { INTERVIEW_CONFIG: "config.json", DATA_DIR: process.env.E2E_DATA_DIR, APP_ORIGIN: "http://127.0.0.1:3000", ADMIN_USERNAME: "e2e-owner", ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD, SESSION_SECRET: randomBytes(32).toString("hex") },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
