// Runs before every test file. Provides the minimum env vars `config/env.ts` requires so tests
// never depend on a real `.env` file or a live database connection existing.
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test"; // never actually connected to in unit tests
process.env.AUTH_SECRET ??= "test-secret-at-least-16-chars";
process.env.LLM_MOCK ??= "true";
