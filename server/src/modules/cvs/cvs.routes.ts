import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../../db/client.js";
import { authed, badRequest } from "../../core/http.js";
import { uploadPdf, assertLooksLikePdf } from "./upload.js";
import { extractPdfText } from "./pdf-extract.service.js";
import {
  CreateCvSchema,
  UpdateCvSchema,
  AnswerQuestionSchema,
  CvContentSchema,
  UpdateTemplateSchema,
  UpdateMetaSchema,
} from "./cv.schemas.js";
import * as cvService from "./cv.service.js";
import { renderCvPdf } from "../../pdf/render.js";
import { isTest } from "../../config/env.js";

export const cvsRouter = Router();

// Generation is the expensive, LLM-backed operation — a tighter limit than the rest of the API.
// Skipped in tests: the whole suite shares one in-memory counter (same process, same "IP"), and
// without this a growing test file eventually starts failing on rate limiting rather than on
// anything the test itself is checking — the same reasoning auth.ts applies to better-auth's own
// limiter.
const createCvLimiter: RequestHandler = isTest
  ? (_req, _res, next) => next()
  : rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

cvsRouter.get(
  "/",
  authed(async (req, res) => {
    const cvs = await cvService.listCvs(db, req.userId);
    res.json({ cvs });
  }),
);

cvsRouter.post(
  "/",
  createCvLimiter,
  uploadPdf,
  authed(async (req, res) => {
    const parsed = CreateCvSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    const { title, targetRole, sourceText } = parsed.data;

    let finalSourceText: string;
    let sourceKind: "pdf" | "text";
    if (req.file) {
      assertLooksLikePdf(req.file.buffer);
      finalSourceText = await extractPdfText(req.file.buffer);
      sourceKind = "pdf";
    } else if (sourceText && sourceText.trim().length > 0) {
      finalSourceText = sourceText;
      sourceKind = "text";
    } else {
      throw badRequest("Provide either a PDF upload or sourceText");
    }

    const cv = await cvService.createCv(db, req.userId, { title, targetRole, sourceKind, sourceText: finalSourceText });
    res.status(202).json({ cv });
  }),
);

cvsRouter.get(
  "/:id",
  authed(async (req, res) => {
    const { cv, questions } = await cvService.getCvWithQuestions(db, req.userId, req.params.id as string);
    res.json({ cv, questions });
  }),
);

cvsRouter.put(
  "/:id",
  authed(async (req, res) => {
    const parsed = UpdateCvSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    const cv = await cvService.updateCvContent(
      db,
      req.userId,
      req.params.id as string,
      parsed.data.content,
      parsed.data.version,
    );
    res.json({ cv });
  }),
);

cvsRouter.put(
  "/:id/template",
  authed(async (req, res) => {
    const parsed = UpdateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    const cv = await cvService.updateTemplate(db, req.userId, req.params.id as string, parsed.data.template);
    res.json({ cv });
  }),
);

cvsRouter.put(
  "/:id/meta",
  authed(async (req, res) => {
    const parsed = UpdateMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    const cv = await cvService.updateMeta(db, req.userId, req.params.id as string, parsed.data);
    res.json({ cv });
  }),
);

cvsRouter.delete(
  "/:id",
  authed(async (req, res) => {
    await cvService.deleteCv(db, req.userId, req.params.id as string);
    res.status(204).end();
  }),
);

cvsRouter.post(
  "/:id/retry",
  authed(async (req, res) => {
    const cv = await cvService.retryGeneration(db, req.userId, req.params.id as string);
    res.status(202).json({ cv });
  }),
);

cvsRouter.post(
  "/:id/questions/:qid/answer",
  authed(async (req, res) => {
    const parsed = AnswerQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
    }
    await cvService.answerQuestion(
      db,
      req.userId,
      req.params.id as string,
      req.params.qid as string,
      parsed.data.answer,
    );
    res.status(202).json({ ok: true });
  }),
);

cvsRouter.post(
  "/:id/questions/:qid/dismiss",
  authed(async (req, res) => {
    await cvService.dismissQuestion(db, req.userId, req.params.id as string, req.params.qid as string);
    res.status(204).end();
  }),
);

cvsRouter.get(
  "/:id/pdf",
  authed(async (req, res) => {
    const { cv } = await cvService.getCvWithQuestions(db, req.userId, req.params.id as string);
    if (!cv.content) {
      throw badRequest("This CV hasn't been generated yet");
    }
    const content = CvContentSchema.parse(cv.content);
    const buffer = await renderCvPdf(content, cv.template);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(cv.title)}.pdf"`);
    res.send(buffer);
  }),
);

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80) || "cv";
}
