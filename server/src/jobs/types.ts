import type { Db } from "../db/client.js";
import type { JobRow } from "./queue.js";

/**
 * One handler per `jobs.type`. `run` does the actual work and may throw — the worker loop
 * catches that and calls `markJobFailedOrRetry`. `onExhausted` only fires once attempts are used
 * up, so a handler can reflect permanent failure somewhere a user will see it (e.g. the CV's
 * `status`/`error` columns) without every transient retry flipping that status back and forth.
 */
export interface JobHandler {
  run(db: Db, job: JobRow): Promise<void>;
  onExhausted(db: Db, job: JobRow, error: string): Promise<void>;
}
