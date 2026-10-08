import { z } from "zod";

// The CV document itself — what gets edited in the UI, stored in `cvs.content`, and rendered to
// PDF. Every string field is optional-ish (default "") rather than required: a missing fact
// should surface as a question (see generation.schemas.ts), never block the whole document from
// saving.
export const ContactSchema = z.object({
  name: z.string().max(200).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(50).default(""),
  location: z.string().max(200).default(""),
  links: z.array(z.string().max(300)).max(10).default([]),
});

export const ExperienceEntrySchema = z.object({
  company: z.string().max(200).default(""),
  title: z.string().max(200).default(""),
  location: z.string().max(200).default(""),
  startDate: z.string().max(50).default(""),
  endDate: z.string().max(50).default(""), // "" or "Present" allowed
  bullets: z.array(z.string().max(400)).max(12).default([]),
});

export const EducationEntrySchema = z.object({
  institution: z.string().max(200).default(""),
  degree: z.string().max(200).default(""),
  field: z.string().max(200).default(""),
  startDate: z.string().max(50).default(""),
  endDate: z.string().max(50).default(""),
});

export const CvContentSchema = z.object({
  contact: ContactSchema,
  summary: z.string().max(1200).default(""),
  experience: z.array(ExperienceEntrySchema).max(30).default([]),
  education: z.array(EducationEntrySchema).max(15).default([]),
  skills: z.array(z.string().max(100)).max(60).default([]),
});

export type Contact = z.infer<typeof ContactSchema>;
export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>;
export type EducationEntry = z.infer<typeof EducationEntrySchema>;
export type CvContent = z.infer<typeof CvContentSchema>;

export const EMPTY_CV_CONTENT: CvContent = {
  contact: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  skills: [],
};

// --- API-facing request bodies -------------------------------------------------------------

export const CreateCvSchema = z.object({
  title: z.string().min(1).max(200),
  targetRole: z.string().min(1).max(200),
  // Present when the user pasted free text instead of uploading a PDF (mutually exclusive with
  // a multipart file upload — see cvs.routes.ts).
  sourceText: z.string().min(1).max(50_000).optional(),
});

export const UpdateCvSchema = z.object({
  content: CvContentSchema,
  version: z.number().int().positive(),
});

export const AnswerQuestionSchema = z.object({
  answer: z.string().min(1).max(2000),
});

export const CvTemplateSchema = z.enum(["classic", "modern"]);
export type CvTemplate = z.infer<typeof CvTemplateSchema>;

export const UpdateTemplateSchema = z.object({
  template: CvTemplateSchema,
});
