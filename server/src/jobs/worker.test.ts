// queue.test.ts covers claimNextJob/markJobDone/markJobFailedOrRetry against a real (PGlite)
// database, but nothing had ever actually run startWorker() itself — the polling loop that ties
// those primitives together, runs JOB_CONCURRENCY lanes, and decides when to call a handler's
// onExhausted. That's the part a crashed/stuck worker or a silently-abandoned lane would show up
// in, so it's exercised directly here with the queue and handlers mocked (startWorker uses the
// shared `db` singleton directly rather than taking one as a parameter, so a real test database
// isn't an option here — this is the orchestration loop being driven, not the primitives it's
// built from, which queue.test.ts already covers against PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRow } from "./queue.js";

const { claimNextJob, markJobDone, markJobFailedOrRetry, generateRun, generateOnExhausted, applyAnswerRun, applyAnswerOnExhausted } =
  vi.hoisted(() => ({
    claimNextJob: vi.fn(),
    markJobDone: vi.fn(),
    markJobFailedOrRetry: vi.fn(),
    generateRun: vi.fn(),
    generateOnExhausted: vi.fn(),
    applyAnswerRun: vi.fn(),
    applyAnswerOnExhausted: vi.fn(),
  }));

vi.mock("./queue.js", () => ({ claimNextJob, markJobDone, markJobFailedOrRetry }));
vi.mock("./handlers/generate.js", () => ({
  generateHandler: { run: generateRun, onExhausted: generateOnExhausted },
}));
vi.mock("./handlers/apply-answer.js", () => ({
  applyAnswerHandler: { run: applyAnswerRun, onExhausted: applyAnswerOnExhausted },
}));

const { env } = await import("../config/env.js");
const { startWorker } = await import("./worker.js");

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    cvId: "cv-1",
    type: "generate",
    payload: {},
    status: "running",
    attempts: 1,
    maxAttempts: 3,
    lockedUntil: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as JobRow;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("startWorker", () => {
  const originalPollInterval = env.JOB_POLL_INTERVAL_MS;
  const originalConcurrency = env.JOB_CONCURRENCY;

  beforeEach(() => {
    vi.clearAllMocks();
    env.JOB_POLL_INTERVAL_MS = 10;
    env.JOB_CONCURRENCY = 1;
    markJobFailedOrRetry.mockResolvedValue("retrying");
  });

  afterEach(() => {
    env.JOB_POLL_INTERVAL_MS = originalPollInterval;
    env.JOB_CONCURRENCY = originalConcurrency;
  });

  it("claims a queued job, runs its handler, and marks it done", async () => {
    const job = makeJob();
    claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    generateRun.mockResolvedValueOnce(undefined);

    const worker = startWorker();
    await vi.waitFor(() => expect(markJobDone).toHaveBeenCalledWith(expect.anything(), job.id));
    expect(generateRun).toHaveBeenCalledTimes(1);
    expect(generateRun.mock.calls[0]![1]).toBe(job);

    worker.stop();
  });

  it("routes a job by type to the matching handler", async () => {
    const job = makeJob({ type: "apply_answer" });
    claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    applyAnswerRun.mockResolvedValueOnce(undefined);

    const worker = startWorker();
    await vi.waitFor(() => expect(markJobDone).toHaveBeenCalled());
    expect(applyAnswerRun).toHaveBeenCalledTimes(1);
    expect(generateRun).not.toHaveBeenCalled();

    worker.stop();
  });

  it("re-queues on a handler failure without calling onExhausted when retries remain", async () => {
    const job = makeJob();
    claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    generateRun.mockRejectedValueOnce(new Error("transient failure"));
    markJobFailedOrRetry.mockResolvedValueOnce("retrying");

    const worker = startWorker();
    await vi.waitFor(() => expect(markJobFailedOrRetry).toHaveBeenCalledWith(expect.anything(), job, "transient failure"));
    expect(generateOnExhausted).not.toHaveBeenCalled();
    expect(markJobDone).not.toHaveBeenCalled();

    worker.stop();
  });

  it("calls the handler's onExhausted once retries run out", async () => {
    const job = makeJob({ attempts: 3, maxAttempts: 3 });
    claimNextJob.mockResolvedValueOnce(job).mockResolvedValue(null);
    generateRun.mockRejectedValueOnce(new Error("final failure"));
    markJobFailedOrRetry.mockResolvedValueOnce("failed");

    const worker = startWorker();
    await vi.waitFor(() => expect(generateOnExhausted).toHaveBeenCalledWith(expect.anything(), job, "final failure"));

    worker.stop();
  });

  it("processes jobs back-to-back without waiting out the poll interval while the queue is non-empty", async () => {
    const jobs = [makeJob({ id: "job-1" }), makeJob({ id: "job-2" }), makeJob({ id: "job-3" })];
    claimNextJob
      .mockResolvedValueOnce(jobs[0])
      .mockResolvedValueOnce(jobs[1])
      .mockResolvedValueOnce(jobs[2])
      .mockResolvedValue(null);
    generateRun.mockResolvedValue(undefined);
    env.JOB_POLL_INTERVAL_MS = 5000; // would blow past any reasonable test timeout if hit even once

    const worker = startWorker();
    await vi.waitFor(() => expect(generateRun).toHaveBeenCalledTimes(3), { timeout: 2000 });
    expect(markJobDone).toHaveBeenCalledTimes(3);

    worker.stop();
  });

  it("runs JOB_CONCURRENCY lanes, each polling independently", async () => {
    env.JOB_CONCURRENCY = 3;
    claimNextJob.mockResolvedValue(null); // nothing to claim, ever

    const worker = startWorker();
    await vi.waitFor(() => expect(claimNextJob.mock.calls.length).toBeGreaterThanOrEqual(3));

    worker.stop();
  });

  it("stop() halts further polling", async () => {
    claimNextJob.mockResolvedValue(null);
    const worker = startWorker();
    await vi.waitFor(() => expect(claimNextJob).toHaveBeenCalled());

    worker.stop();
    const countAtStop = claimNextJob.mock.calls.length;
    await sleep(env.JOB_POLL_INTERVAL_MS * 5);
    // Allow for one in-flight poll to land right after stop(), but no sustained polling after that.
    expect(claimNextJob.mock.calls.length).toBeLessThanOrEqual(countAtStop + 1);
  });
});
