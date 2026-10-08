import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

// Repository functions take `Db` so they work with: the top-level connection, a `tx` passed
// from inside `db.transaction(async (tx) => ...)` (cv.service.ts#createCv), AND the PGlite
// instance tests substitute in (db/test-db.ts) — three different driver HKTs. The query-result
// HKT parameter is left `any` deliberately: it's the one spot genuinely generic over "whichever
// Postgres driver this happens to be", same as drizzle's own `AnyPgDatabase`-style helpers.
export type Db =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | PgDatabase<any, typeof schema>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | PgTransaction<any, typeof schema, ExtractTablesWithRelations<typeof schema>>;
