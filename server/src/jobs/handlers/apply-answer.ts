import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { cvs, cvQuestions } from "../../db/schema/index.js";
import { updateCvContentCas } from "../../modules/cvs/cv.repo.js";
import { listAnsweredTexts } from "../../modules/cvs/questions.repo.js";
import { CvContentSchema } from "../../modules/cvs/cv.schemas.js";
import { updateSection } from "../../llm/generation.service.js";
import { getByPath, setByPath } from "../../core/json-path.js";
import { logger } from "../../core/logger.js";
import type { JobHandler } from "../types.js";
import type { JobRow } from "../queue.js";

interface ApplyAnswerPayload {
  questionId: string;
}

const MAX_CAS_RETRIES = 3;

export const applyAnswerHandler: JobHandler = {
  async run(db: Db, job: JobRow): Promise<void> {
    const payload = job.payload as ApplyAnswerPayload;
    const [question] = await db.select().from(cvQuestions).where(eq(cvQuestions.id, payload.questionId));
    if (!question || !question.answer) return; // deleted, or somehow re-run before an answer landed

    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      const [cv] = await db.select().from(cvs).where(eq(cvs.id, job.cvId));
      if (!cv) return;

      const currentContent = cv.content ?? {};
      const currentValue = getByPath(currentContent, question.fieldPath);
      const priorAnswers = (await listAnsweredTexts(db, cv.id)).filter((a) => a !== question.answer);

      const { value } = await updateSection({
        fieldPath: question.fieldPath,
        currentValue,
        question: question.question,
        answer: question.answer,
        sourceText: cv.sourceText,
        priorAnswers,
      });

      const nextContent = structuredClone(currentContent) as Record<string, unknown>;
      setByPath(nextContent, question.fieldPath, value);

      const parsed = CvContentSchema.safeParse(nextContent);
      if (!parsed.success) {
        throw new Error(`Applying answer for ${question.fieldPath} produced an invalid CV: ${parsed.error.message}`);
      }

      const updated = await updateCvContentCas(db, cv.id, parsed.data, cv.version);
      if (updated) return; // success

      // Someone (a manual edit, or another apply-answer job) wrote a newer version concurrently.
      // Re-read and recompute against the fresh content rather than overwriting their change.
      logger.warn({ cvId: cv.id, fieldPath: question.fieldPath }, "CAS conflict applying answer, retrying");
    }

    throw new Error(`Could not apply answer for ${question.fieldPath} after ${MAX_CAS_RETRIES} CAS retries`);
  },

  async onExhausted(_db: Db, job: JobRow, error: string): Promise<void> {
    // Unlike generation, a failed section update doesn't fail the whole CV — the user's answer
    // is still recorded (cv_questions.answer), they just didn't get an automatic merge. They can
    // still edit the field by hand. Just log it; nothing in the schema needs updating.
    logger.error({ jobId: job.id, cvId: job.cvId, error }, "apply_answer job exhausted retries");
  },
};
