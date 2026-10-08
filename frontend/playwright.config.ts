import { defineConfig, devices } from "@playwright/test";

const remoteBase = process.env.INFERA_E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: remoteBase ? "test-results/production-results.json" : "test-results/local-results.json" }]],
  use: { baseURL: remoteBase || "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: remoteBase ? undefined : [
    {
      command: "../backend/.venv/bin/python -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8001",
      url: "http://127.0.0.1:8001/health",
      env: { CORS_ORIGINS: '["http://127.0.0.1:3100"]', OMP_NUM_THREADS: "1", OPENBLAS_NUM_THREADS: "1", MKL_NUM_THREADS: "1" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    { command: "npm run start -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 60_000 },
  ],
});
