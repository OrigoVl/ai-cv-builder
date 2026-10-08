import { db } from "../db/client.js";
import { env } from "../config/env.js";
import { logger } from "../core/logger.js";
import { claimNextJob, markJobDone, markJobFailedOrRetry, type JobRow } from "./queue.js";
import { generateHandler } from "./handlers/generate.js";
import { applyAnswerHandler } from "./handlers/apply-answer.js";
import type { JobHandler } from "./types.js";

const handlers: Record<JobRow["type"], JobHandler> = {
  generate: generateHandler,
  apply_answer: applyAnswerHandler,
};

async function processJob(job: JobRow): Promise<void> {
  const handler = handlers[job.type];
  try {
    await handler.run(db, job);
    await markJobDone(db, job.id);
    logger.info({ jobId: job.id, type: job.type, cvId: job.cvId }, "job done");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const outcome = await markJobFailedOrRetry(db, job, message);
    logger.warn({ jobId: job.id, type: job.type, attempt: job.attempts, outcome, error: message }, "job failed");
    if (outcome === "failed") {
      await handler.onExhausted(db, job, message);
    }
  }
}

/** One polling lane: repeatedly claims and processes a job, or sleeps `JOB_POLL_INTERVAL_MS` when
 * the queue is empty. Running `JOB_CONCURRENCY` of these lanes concurrently is the entire
 * "worker pool" — no separate process, no message broker, just JS concurrency over shared
 * Postgres rows guarded by `FOR UPDATE SKIP LOCKED` (queue.ts). */
async function runLane(lane: number, signal: { stopped: boolean }): Promise<void> {
  while (!signal.stopped) {
    let job: JobRow | null = null;
    try {
      job = await claimNextJob(db);
    } catch (err) {
      logger.error({ lane, err }, "failed to claim job, backing off");
    }
    if (job) {
      await processJob(job);
      continue; // immediately look for the next job rather than waiting out the poll interval
    }
    await sleep(env.JOB_POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WorkerHandle {
  stop(): void;
}

export function startWorker(): WorkerHandle {
  const signal = { stopped: false };
  const lanes = Array.from({ length: env.JOB_CONCURRENCY }, (_, i) => runLane(i, signal));
  logger.info({ concurrency: env.JOB_CONCURRENCY }, "job worker started");
  Promise.all(lanes).catch((err) => logger.error({ err }, "worker lane crashed"));
  return {
    stop(): void {
      signal.stopped = true;
    },
  };
}
