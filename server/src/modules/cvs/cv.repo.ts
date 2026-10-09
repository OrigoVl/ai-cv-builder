import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { cvs } from "../../db/schema/index.js";
import type { CvContent, CvTemplate } from "./cv.schemas.js";

export type CvRow = typeof cvs.$inferSelect;

export async function listCvsByUser(db: Db, userId: string): Promise<CvRow[]> {
  return db.select().from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.updatedAt));
}

/** The single authorization chokepoint for every CV-scoped route: a row is only ever returned
 * when it belongs to `userId`. Every route handler that takes a `:id` goes through this (or the
 * question-repo equivalent, which joins back to this) — see cvs.routes.ts. */
export async function getOwnedCv(db: Db, userId: string, id: string): Promise<CvRow | null> {
  const [row] = await db
    .select()
    .from(cvs)
    .where(and(eq(cvs.id, id), eq(cvs.userId, userId)));
  return row ?? null;
}

export async function countGeneratingCvs(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ id: cvs.id })
    .from(cvs)
    .where(and(eq(cvs.userId, userId), eq(cvs.status, "generating")));
  return rows.length;
}

export interface CreateCvInput {
  userId: string;
  title: string;
  targetRole: string;
  sourceKind: "pdf" | "text";
  sourceText: string;
}

export async function insertCv(db: Db, input: CreateCvInput): Promise<CvRow> {
  const [row] = await db
    .insert(cvs)
    .values({ ...input, status: "generating" })
    .returning();
  if (!row) throw new Error("Failed to create CV");
  return row;
}

export async function setCvStatus(
  db: Db,
  id: string,
  status: CvRow["status"],
  extra: { content?: CvContent; error?: string | null } = {},
): Promise<void> {
  await db
    .update(cvs)
    .set({ status, ...extra, updatedAt: new Date() })
    .where(eq(cvs.id, id));
}

/**
 * Compare-and-swap write: only succeeds (returns the new row) if `expectedVersion` still matches
 * what's stored. Used by both manual edits (PUT /cvs/:id) and the apply-answer job, so neither
 * can silently clobber the other's concurrent write — see README's concurrency section.
 */
export async function updateCvContentCas(
  db: Db,
  id: string,
  content: CvContent,
  expectedVersion: number,
): Promise<CvRow | null> {
  const [row] = await db
    .update(cvs)
    .set({ content, version: expectedVersion + 1, updatedAt: new Date() })
    .where(and(eq(cvs.id, id), eq(cvs.version, expectedVersion)))
    .returning();
  return row ?? null;
}

export async function deleteCv(db: Db, id: string): Promise<void> {
  await db.delete(cvs).where(eq(cvs.id, id));
}

export async function setCvTemplate(db: Db, id: string, template: CvTemplate): Promise<CvRow | null> {
  const [row] = await db.update(cvs).set({ template, updatedAt: new Date() }).where(eq(cvs.id, id)).returning();
  return row ?? null;
}

export async function setCvMeta(
  db: Db,
  id: string,
  meta: { title: string; targetRole: string },
): Promise<CvRow | null> {
  const [row] = await db.update(cvs).set({ ...meta, updatedAt: new Date() }).where(eq(cvs.id, id)).returning();
  return row ?? null;
}
