import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";
import { logger } from "../core/logger.js";

/**
 * Applies every committed migration under `drizzle/` that hasn't run yet. Safe to call on every
 * boot (drizzle tracks what's applied in its own `__drizzle_migrations` table), which is how a
 * fresh `docker compose up` ends up with an up-to-date schema with no manual step.
 */
export async function runMigrations(): Promise<void> {
  logger.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  logger.info("Migrations complete.");
}

// Allow `pnpm db:migrate` to run this standalone, in addition to being called from index.ts.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      logger.error(err, "Migration failed");
      process.exit(1);
    });
}
