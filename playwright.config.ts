import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (run with `pnpm test:e2e`). They build the shop and start it
 * on port 3100 against the database in .env, with emails saved to
 * .emails/e2e instead of being sent. Payments use Stripe TEST mode only —
 * the test refuses to run with a live key.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 400_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      AUTH_URL: `http://localhost:${PORT}`,
      AUTH_TRUST_HOST: "true",
      RESEND_API_KEY: "", // never send real emails from a test
      EMAIL_OUTBOX_DIR: ".emails/e2e",
    },
  },
});
