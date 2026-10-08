// PGlite-backed Drizzle instance for integration tests — a real (in-process, WASM) Postgres, no
// Docker/network required. Applies the same generated migration SQL (server/drizzle/*.sql) that
// the real app runs, so tests exercise the actual schema (enums, FKs, defaults), not a
// hand-rolled approximation of it.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "url";
import path from "path";
import * as schema from "./schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "..", "..", "drizzle");

/** A fresh, empty, fully-migrated in-process Postgres — one per test file/suite, never shared. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/**
 * Every app table's `user_id` is a real FK to `user.id` (schema/auth.ts) — a test inserting a cv
 * for a given userId needs a matching `user` row to exist first, or Postgres rejects the insert.
 * Call once per test userId before exercising app tables against it.
 */
export async function insertTestUser(db: TestDb, id: string, email = `${id}@example.test`): Promise<void> {
  await db.insert(schema.user).values({ id, name: id, email });
}
