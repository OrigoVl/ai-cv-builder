// The job queue itself: enqueue, atomically claim, and resolve (done/retry/fail). Backed by the
// `jobs` Postgres table — no Redis/BullMQ. The claim query below is the whole trick that makes
// this safe with multiple workers (we run JOB_CONCURRENCY workers in-process) and crash-safe
// across restarts: `FOR UPDATE SKIP LOCKED` lets concurrent claimers each get a different row
// without blocking on each other, and re-claiming any row whose `locked_until` has passed is what
// recovers a job a worker crashed while holding (no heartbeat/ack protocol needed beyond that).
import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { jobs } from "../db/schema/index.js";
import { env } from "../config/env.js";

export type JobRow = typeof jobs.$inferSelect;
export type JobType = JobRow["type"];

export interface EnqueueInput {
  cvId: string;
  type: JobType;
  payload: Record<string, unknown>;
}

/** Inserts a queued job row. Callers that need "create the CV and enqueue its job atomically"
 * (so a crash between the two never leaves a CV stuck in `generating` forever) pass a
 * transaction's `tx` in place of `db` — see cvs.service.ts. */
export async function enqueueJob(db: Db, input: EnqueueInput): Promise<JobRow> {
  const [row] = await db
    .insert(jobs)
    .values({ cvId: input.cvId, type: input.type, payload: input.payload })
    .returning();
  if (!row) throw new Error("Failed to enqueue job");
  return row;
}

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const maybeRows = (result as { rows?: T[] }).rows;
  return maybeRows ?? [];
}

/**
 * Atomically claims one eligible job (queued, or running-but-stale past its lock) and marks it
 * running. Returns null when there's nothing to do. `attempts` is incremented here, at claim
 * time, not on failure — so attempt 1 is the first try, matching how `maxAttempts` reads.
 */
export async function claimNextJob(db: Db): Promise<JobRow | null> {
  const lockedUntil = new Date(Date.now() + env.JOB_LOCK_MS);
  const result = await db.execute(sql`
    UPDATE jobs
    SET status = 'running', locked_until = ${lockedUntil}, attempts = attempts + 1, updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'queued' OR (status = 'running' AND locked_until < now())
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const claimedId = extractRows<{ id: string }>(result)[0]?.id;
  if (!claimedId) return null;

  const [row] = await db.select().from(jobs).where(eq(jobs.id, claimedId));
  return row ?? null;
}

export async function markJobDone(db: Db, jobId: string): Promise<void> {
  await db.update(jobs).set({ status: "done", lastError: null, updatedAt: new Date() }).where(eq(jobs.id, jobId));
}

/** Failure path: re-queue for another attempt if `attempts < maxAttempts`, otherwise mark
 * `failed` for good (the CV/question layer is responsible for reflecting that to the user). */
export async function markJobFailedOrRetry(db: Db, job: JobRow, error: string): Promise<"retrying" | "failed"> {
  const willRetry = job.attempts < job.maxAttempts;
  await db
    .update(jobs)
    .set({
      status: willRetry ? "queued" : "failed",
      lastError: error,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));
  return willRetry ? "retrying" : "failed";
}
