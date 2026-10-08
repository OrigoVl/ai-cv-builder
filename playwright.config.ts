import { defineConfig } from "@playwright/test";

// Runs against an already-running app (either `docker compose up` or `pnpm dev`) rather than
// starting one itself — see README's "Tests" section for the exact commands. Set LLM_MOCK=true
// on the server before starting it so generation is deterministic and needs no API key.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
