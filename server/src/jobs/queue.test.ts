import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, insertTestUser, type TestDb } from "../db/test-db.js";
import { cvs, jobs } from "../db/schema/index.js";
import { claimNextJob, enqueueJob, markJobDone, markJobFailedOrRetry } from "./queue.js";

async function insertCv(db: TestDb, userId: string) {
  const [row] = await db
    .insert(cvs)
    .values({ userId, title: "Test CV", targetRole: "Engineer", sourceKind: "text", sourceText: "hello" })
    .returning();
  return row!;
}

describe("job queue", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await createTestDb();
    await insertTestUser(db, "user-1");
  });

  it("claims a queued job exactly once", async () => {
    const cv = await insertCv(db, "user-1");
    await enqueueJob(db, { cvId: cv.id, type: "generate", payload: {} });

    const claimed = await claimNextJob(db);
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempts).toBe(1);

    const secondClaim = await claimNextJob(db);
    expect(secondClaim).toBeNull(); // nothing else queued
  });

  it("returns null when the queue is empty", async () => {
    expect(await claimNextJob(db)).toBeNull();
  });

  it("marks a job done", async () => {
    const cv = await insertCv(db, "user-1");
    const job = await enqueueJob(db, { cvId: cv.id, type: "generate", payload: {} });
    await claimNextJob(db);
    await markJobDone(db, job.id);

    const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(row?.status).toBe("done");
  });

  it("re-queues a failed job until attempts run out, then marks it failed", async () => {
    const cv = await insertCv(db, "user-1");
    const job = await enqueueJob(db, { cvId: cv.id, type: "generate", payload: {} });

    // maxAttempts defaults to 3 — simulate three failed attempts.
    for (let i = 0; i < 2; i++) {
      const claimed = await claimNextJob(db);
      const outcome = await markJobFailedOrRetry(db, claimed!, `attempt ${i} failed`);
      expect(outcome).toBe("retrying");
    }
    const lastClaim = await claimNextJob(db);
    const outcome = await markJobFailedOrRetry(db, lastClaim!, "final failure");
    expect(outcome).toBe("failed");

    const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(row?.status).toBe("failed");
    expect(row?.lastError).toBe("final failure");
    expect(row?.attempts).toBe(3);
  });

  it("recovers a job left 'running' past its lock (simulating a crashed worker)", async () => {
    const cv = await insertCv(db, "user-1");
    const job = await enqueueJob(db, { cvId: cv.id, type: "generate", payload: {} });
    await claimNextJob(db); // now running

    // Simulate the lock having expired without anyone marking it done/failed.
    await db.update(jobs).set({ lockedUntil: new Date(Date.now() - 1000) }).where(eq(jobs.id, job.id));

    const reclaimed = await claimNextJob(db);
    expect(reclaimed?.id).toBe(job.id);
    expect(reclaimed?.attempts).toBe(2); // incremented again on re-claim
  });

  it("claims jobs in FIFO order", async () => {
    const cv = await insertCv(db, "user-1");
    const first = await enqueueJob(db, { cvId: cv.id, type: "generate", payload: { order: 1 } });
    await new Promise((r) => setTimeout(r, 5));
    await enqueueJob(db, { cvId: cv.id, type: "generate", payload: { order: 2 } });

    const claimed = await claimNextJob(db);
    expect(claimed?.id).toBe(first.id);
  });
});
