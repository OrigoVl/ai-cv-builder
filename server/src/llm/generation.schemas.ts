import { z } from "zod";
import { CvContentSchema } from "../modules/cvs/cv.schemas.js";
import { sectionValueSchema } from "./section-schema.js";

// What the model must hand back from the `submit_cv` tool call. This is intentionally a
// *superset* of CvContentSchema: `evidence` and `questions` exist purely so the grounding
// checker (grounding.ts) can verify facts before anything reaches the stored CV, and never get
// persisted to `cvs.content` themselves.
export const EvidenceItemSchema = z.object({
  // Dot/bracket path matching the field it supports, e.g. "experience[0].bullets[1]" or
  // "experience[0].company". One evidence item per checkable claim — a bullet with two numbers
  // in it should still cite a single quote that covers both, see the system prompt.
  path: z.string().min(1).max(200),
  // A short VERBATIM excerpt from the source document that supports this field's content.
  // Checked with fuzzy substring matching in grounding.ts — not required to be character-exact,
  // but must not be invented.
  quote: z.string().min(1).max(500),
});

export const GeneratedQuestionSchema = z.object({
  fieldPath: z.string().min(1).max(200),
  question: z.string().min(1).max(300),
  reason: z.string().max(300).default(""),
});

export const GenerationResultSchema = z.object({
  cv: CvContentSchema,
  evidence: z.array(EvidenceItemSchema).max(200).default([]),
  questions: z.array(GeneratedQuestionSchema).max(30).default([]),
});

export type GenerationResult = z.infer<typeof GenerationResultSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

// For the smaller "apply one answer" call — only touches the section named by fieldPath, so the
// model doesn't need to (and can't) silently rewrite unrelated parts of the CV. The shape of
// `value` is resolved per-call from `fieldPath` (see section-schema.ts) rather than left as
// `z.unknown()`, so the tool's JSON Schema actually constrains what the model can return for
// the field it's touching.
export function sectionUpdateResultSchema(fieldPath: string) {
  return z.object({
    value: sectionValueSchema(fieldPath),
    evidence: z.array(EvidenceItemSchema).max(20).default([]),
  });
}

export type SectionUpdateResult = { value: unknown; evidence: EvidenceItem[] };
