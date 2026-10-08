import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { cvs } from "../../db/schema/index.js";
import { setCvStatus } from "../../modules/cvs/cv.repo.js";
import { replaceOpenQuestions } from "../../modules/cvs/questions.repo.js";
import { generateCv } from "../../llm/generation.service.js";
import type { JobHandler } from "../types.js";
import type { JobRow } from "../queue.js";

export const generateHandler: JobHandler = {
  async run(db: Db, job: JobRow): Promise<void> {
    const [cv] = await db.select().from(cvs).where(eq(cvs.id, job.cvId));
    if (!cv) return; // the CV was deleted while this job was queued — nothing left to do

    const outcome = await generateCv(cv.sourceText, cv.targetRole);

    await db.transaction(async (tx) => {
      await setCvStatus(tx, cv.id, "ready", { content: outcome.cv, error: null });
      await replaceOpenQuestions(tx, cv.id, outcome.questions);
    });
  },

  async onExhausted(db: Db, job: JobRow, error: string): Promise<void> {
    await setCvStatus(db, job.cvId, "failed", { error });
  },
};
