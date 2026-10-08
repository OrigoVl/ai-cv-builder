// Regression test for a real bug: z.coerce.boolean() on a string env var just calls the JS
// Boolean() constructor, and Boolean("false") is `true` (any non-empty string is truthy) — so
// LLM_MOCK=false in docker-compose.yml/.env was being parsed as `true` unconditionally, silently
// forcing mock mode even with a real ANTHROPIC_API_KEY configured. Caught by actually running the
// app against a real key and seeing mock output, not by reading the code.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV = {
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  AUTH_SECRET: "test-secret-at-least-16-chars",
};

/** Sets only the specific keys under test (never wholesale-replaces process.env, which other
 * test files' own state — e.g. test/setup.ts's LLM_MOCK default — depend on surviving). */
async function loadEnvWith(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  const merged = { ...REQUIRED_ENV, ...overrides };
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(merged)) previous[key] = process.env[key];

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await import("./env.js");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("LLM_MOCK parsing", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.resetModules());

  it("parses the literal string 'false' as false (the actual bug)", async () => {
    const { env } = await loadEnvWith({ LLM_MOCK: "false", ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(env.LLM_MOCK).toBe(false);
  });

  it("parses 'true' as true", async () => {
    const { env } = await loadEnvWith({ LLM_MOCK: "true" });
    expect(env.LLM_MOCK).toBe(true);
  });

  it("defaults to false when unset", async () => {
    const { env } = await loadEnvWith({ LLM_MOCK: undefined, ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(env.LLM_MOCK).toBe(false);
  });

  it("useLlmMock is false when LLM_MOCK='false' and a key is configured", async () => {
    const { useLlmMock } = await loadEnvWith({ LLM_MOCK: "false", ANTHROPIC_API_KEY: "sk-ant-test" });
    expect(useLlmMock).toBe(false);
  });

  it("useLlmMock still falls back to true with no key, even if LLM_MOCK='false'", async () => {
    const { useLlmMock } = await loadEnvWith({ LLM_MOCK: "false", ANTHROPIC_API_KEY: undefined });
    expect(useLlmMock).toBe(true);
  });
});
