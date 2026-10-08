import { pgTable, text, timestamp, integer, jsonb, pgEnum, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import type { CvContent } from "../../modules/cvs/cv.schemas.js";

export const sourceKindEnum = pgEnum("source_kind", ["pdf", "text"]);
export const cvStatusEnum = pgEnum("cv_status", ["draft", "generating", "ready", "failed"]);
export const questionStatusEnum = pgEnum("question_status", ["open", "answered", "dismissed"]);
export const jobTypeEnum = pgEnum("job_type", ["generate", "apply_answer"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "done", "failed"]);

export const cvs = pgTable("cvs", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text().notNull(),
  targetRole: text("target_role").notNull(),
  sourceKind: sourceKindEnum("source_kind").notNull(),
  // Extracted/raw text only — the uploaded PDF binary itself is never persisted (see README).
  sourceText: text("source_text").notNull(),
  status: cvStatusEnum().notNull().default("draft"),
  error: text(),
  // Validated against the Cv zod schema (modules/cvs/cv.schemas.ts) before being written here.
  content: jsonb().$type<CvContent>(),
  // Optimistic-concurrency counter bumped on every successful write to `content`.
  version: integer().notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cvQuestions = pgTable("cv_questions", {
  id: uuid().primaryKey().defaultRandom(),
  cvId: uuid("cv_id")
    .notNull()
    .references(() => cvs.id, { onDelete: "cascade" }),
  // Dot/bracket path into the CV content, e.g. "experience[1].bullets[0]" or "contact.email".
  fieldPath: text("field_path").notNull(),
  question: text().notNull(),
  reason: text(),
  answer: text(),
  status: questionStatusEnum().notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid().primaryKey().defaultRandom(),
  cvId: uuid("cv_id")
    .notNull()
    .references(() => cvs.id, { onDelete: "cascade" }),
  type: jobTypeEnum().notNull(),
  payload: jsonb().notNull().default({}),
  status: jobStatusEnum().notNull().default("queued"),
  attempts: integer().notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lockedUntil: timestamp("locked_until"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
