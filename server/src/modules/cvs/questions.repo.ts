import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { cvQuestions } from "../../db/schema/index.js";
import type { GeneratedQuestion } from "../../llm/generation.schemas.js";

export type QuestionRow = typeof cvQuestions.$inferSelect;

export async function listQuestionsByCv(db: Db, cvId: string): Promise<QuestionRow[]> {
  return db.select().from(cvQuestions).where(eq(cvQuestions.cvId, cvId));
}

export async function replaceOpenQuestions(db: Db, cvId: string, questions: GeneratedQuestion[]): Promise<void> {
  // Generation runs at most once per CV in the happy path, but a retry after a failure re-runs
  // it — clearing prior open questions first keeps us from double-asking the same thing.
  await db.delete(cvQuestions).where(and(eq(cvQuestions.cvId, cvId), eq(cvQuestions.status, "open")));
  if (questions.length === 0) return;
  await db.insert(cvQuestions).values(
    questions.map((q) => ({
      cvId,
      fieldPath: q.fieldPath,
      question: q.question,
      reason: q.reason,
    })),
  );
}

export async function addQuestions(db: Db, cvId: string, questions: GeneratedQuestion[]): Promise<void> {
  if (questions.length === 0) return;
  await db.insert(cvQuestions).values(
    questions.map((q) => ({
      cvId,
      fieldPath: q.fieldPath,
      question: q.question,
      reason: q.reason,
    })),
  );
}

/** Authorization goes through the CV (see cv.repo.ts#getOwnedCv) at the route layer; this just
 * also pins the question to the specific CV it's expected to belong to. */
export async function getQuestionForCv(db: Db, cvId: string, questionId: string): Promise<QuestionRow | null> {
  const [row] = await db
    .select()
    .from(cvQuestions)
    .where(and(eq(cvQuestions.id, questionId), eq(cvQuestions.cvId, cvId)));
  return row ?? null;
}

export async function answerQuestion(db: Db, id: string, answer: string): Promise<void> {
  await db
    .update(cvQuestions)
    .set({ answer, status: "answered", updatedAt: new Date() })
    .where(eq(cvQuestions.id, id));
}

export async function dismissQuestion(db: Db, id: string): Promise<void> {
  await db.update(cvQuestions).set({ status: "dismissed", updatedAt: new Date() }).where(eq(cvQuestions.id, id));
}

/** All previously-answered questions' answers for a CV, used as part of the "trusted corpus" the
 * grounding checker allows new facts to come from (see generation.service.ts#updateSection). */
export async function listAnsweredTexts(db: Db, cvId: string): Promise<string[]> {
  const rows = await db
    .select({ answer: cvQuestions.answer })
    .from(cvQuestions)
    .where(and(eq(cvQuestions.cvId, cvId), eq(cvQuestions.status, "answered")));
  return rows.map((r) => r.answer).filter((a): a is string => !!a);
}
