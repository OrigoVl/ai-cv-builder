import { defineConfig } from "@playwright/test";

// Runs against an already-running app (either `docker compose up` or `pnpm dev`) rather than
// starting one itself — see README's "Tests" section for the exact commands. Set LLM_MOCK=true
// on the server before starting it so generation is deterministic and needs no API key.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  // All specs hit one real server backed by one real rate limiter (auth.ts's better-auth
  // config) and one job queue — running spec files in parallel workers means their auth/API
  // calls compete for the same limits and can trip them on nothing but test concurrency, not
  // anything a single real user would do. Serializing keeps the suite deterministic.
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
