import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Workflow: `pnpm db:generate` writes a new SQL file under drizzle/ from schema changes; those
// files are committed to git. `drizzle-kit push` is never used — migrations are reviewed, not
// inferred at runtime. `src/db/client.ts` applies committed migrations automatically on boot.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/cvbuilder",
  },
});
