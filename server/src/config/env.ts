import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  ANTHROPIC_MODEL_FAST: z.string().default("claude-haiku-4-5"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  // When set, LLM calls are served from local fixtures instead of calling Anthropic.
  // Used by tests and by `docker compose up` when no key is configured yet.
  LLM_MOCK: z.coerce.boolean().default(false),

  JOB_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  JOB_CONCURRENCY: z.coerce.number().int().positive().default(2),
  JOB_LOCK_MS: z.coerce.number().int().positive().default(120_000),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

// Effective mock flag: explicit opt-in (LLM_MOCK=true), OR no key configured at all — the
// latter means a fresh `docker compose up` with ANTHROPIC_API_KEY left blank still runs the
// whole flow end-to-end (with mock output) instead of every generation job failing.
export const useLlmMock = env.LLM_MOCK || !env.ANTHROPIC_API_KEY;
