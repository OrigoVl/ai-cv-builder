import type { Db } from "../../db/client.js";
import { badRequest, conflict, notFound } from "../../core/http.js";
import {
  countGeneratingCvs,
  deleteCv as deleteCvRow,
  getOwnedCv,
  insertCv,
  listCvsByUser,
  setCvStatus,
  updateCvContentCas,
  type CvRow,
} from "./cv.repo.js";
import {
  answerQuestion as answerQuestionRow,
  dismissQuestion as dismissQuestionRow,
  getQuestionForCv,
  listQuestionsByCv,
  type QuestionRow,
} from "./questions.repo.js";
import { enqueueJob } from "../../jobs/queue.js";
import type { CvContent } from "./cv.schemas.js";

// Long CVs/cover letters get truncated before ever reaching the model — keeps prompts (and
// token spend) bounded, and a real CV is never anywhere near this long.
const SOURCE_TEXT_MAX_CHARS = 30_000;

export interface CvWithQuestions {
  cv: CvRow;
  questions: QuestionRow[];
}

export async function createCv(
  db: Db,
  userId: string,
  input: { title: string; targetRole: string; sourceKind: "pdf" | "text"; sourceText: string },
): Promise<CvRow> {
  if (await countGeneratingCvs(db, userId)) {
    throw conflict("You already have a CV generating. Wait for it to finish before starting another.");
  }
  const sourceText = input.sourceText.slice(0, SOURCE_TEXT_MAX_CHARS);

  // Insert + enqueue in one transaction: either both happen, or neither does. Without this, a
  // crash between the two steps could leave a CV stuck in "generating" forever with no job ever
  // created to finish it.
  return db.transaction(async (tx) => {
    const cv = await insertCv(tx, {
      userId,
      title: input.title,
      targetRole: input.targetRole,
      sourceKind: input.sourceKind,
      sourceText,
    });
    await enqueueJob(tx, { cvId: cv.id, type: "generate", payload: {} });
    return cv;
  });
}

export async function getCvWithQuestions(db: Db, userId: string, id: string): Promise<CvWithQuestions> {
  const cv = await getOwnedCv(db, userId, id);
  if (!cv) throw notFound("CV not found");
  const questions = await listQuestionsByCv(db, id);
  return { cv, questions };
}

export async function listCvs(db: Db, userId: string): Promise<CvRow[]> {
  return listCvsByUser(db, userId);
}

export async function updateCvContent(
  db: Db,
  userId: string,
  id: string,
  content: CvContent,
  version: number,
): Promise<CvRow> {
  const existing = await getOwnedCv(db, userId, id);
  if (!existing) throw notFound("CV not found");
  const updated = await updateCvContentCas(db, id, content, version);
  if (!updated) {
    throw conflict("This CV was changed elsewhere. Reload to see the latest version before editing again.");
  }
  return updated;
}

export async function retryGeneration(db: Db, userId: string, id: string): Promise<CvRow> {
  const existing = await getOwnedCv(db, userId, id);
  if (!existing) throw notFound("CV not found");
  if (existing.status !== "failed") {
    throw badRequest("Only a failed CV can be retried");
  }
  await setCvStatus(db, id, "generating", { error: null });
  await enqueueJob(db, { cvId: id, type: "generate", payload: {} });
  const refreshed = await getOwnedCv(db, userId, id);
  return refreshed!;
}

export async function deleteCv(db: Db, userId: string, id: string): Promise<void> {
  const existing = await getOwnedCv(db, userId, id);
  if (!existing) throw notFound("CV not found");
  await deleteCvRow(db, id);
}

export async function answerQuestion(
  db: Db,
  userId: string,
  cvId: string,
  questionId: string,
  answer: string,
): Promise<void> {
  const cv = await getOwnedCv(db, userId, cvId);
  if (!cv) throw notFound("CV not found");
  const question = await getQuestionForCv(db, cvId, questionId);
  if (!question) throw notFound("Question not found");

  await answerQuestionRow(db, questionId, answer);
  await enqueueJob(db, { cvId, type: "apply_answer", payload: { questionId } });
}

export async function dismissQuestion(db: Db, userId: string, cvId: string, questionId: string): Promise<void> {
  const cv = await getOwnedCv(db, userId, cvId);
  if (!cv) throw notFound("CV not found");
  const question = await getQuestionForCv(db, cvId, questionId);
  if (!question) throw notFound("Question not found");
  await dismissQuestionRow(db, questionId);
}
