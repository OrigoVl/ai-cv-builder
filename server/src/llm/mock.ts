// Deterministic, offline stand-ins for the two LLM calls, used when `LLM_MOCK=1` (tests, CI, and
// a `docker compose up` before ANTHROPIC_API_KEY is configured). These are intentionally simple
// heuristics, not a model — the goal is to exercise the full pipeline (job → grounding → storage
// → PDF) without a network call, not to produce a great CV. Every value they emit is extracted
// directly from the source text, so the grounding checker should never need to touch mock output.
import type { GenerationResult, SectionUpdateResult } from "./generation.schemas.js";
import { EMPTY_CV_CONTENT } from "../modules/cvs/cv.schemas.js";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /\+?\d[\d\-\s()]{7,}\d/;

export function mockGenerateCv(sourceText: string, targetRole: string): GenerationResult {
  const lines = sourceText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const email = sourceText.match(EMAIL_RE)?.[0] ?? "";
  const phone = sourceText.match(PHONE_RE)?.[0] ?? "";

  const evidence: GenerationResult["evidence"] = [];
  if (firstLine && !EMAIL_RE.test(firstLine) && firstLine.length < 60) {
    evidence.push({ path: "contact.name", quote: firstLine });
  }

  const questions: GenerationResult["questions"] = [
    {
      fieldPath: "experience",
      question: "LLM_MOCK is enabled, so work history wasn't extracted automatically. Add your experience manually?",
      reason: "Mock mode only extracts contact details deterministically.",
    },
  ];

  return {
    cv: {
      ...EMPTY_CV_CONTENT,
      contact: {
        ...EMPTY_CV_CONTENT.contact,
        name: firstLine.length < 60 && !EMAIL_RE.test(firstLine) ? firstLine : "",
        email,
        phone,
      },
      summary: targetRole ? `Candidate targeting the ${targetRole} role. (mock generation — edit this summary)` : "",
    },
    evidence,
    questions,
  };
}

export function mockUpdateSection(fieldPath: string, currentValue: unknown, answer: string): SectionUpdateResult {
  const evidence = [{ path: fieldPath, quote: answer }];

  // The mock's own generated question (mockGenerateCv, above) always points at "experience" —
  // an array of OBJECTS, not strings. A naive `[...current, answer]` would push a raw string
  // into a field that must validate as ExperienceEntry[] and fail downstream. Synthesize a
  // minimal structured entry instead, same idea for "education".
  if (fieldPath === "experience" && Array.isArray(currentValue)) {
    return {
      value: [...currentValue, { company: "", title: "", location: "", startDate: "", endDate: "", bullets: [answer] }],
      evidence,
    };
  }
  if (fieldPath === "education" && Array.isArray(currentValue)) {
    return {
      value: [...currentValue, { institution: "", degree: "", field: "", startDate: "", endDate: "" }],
      evidence,
    };
  }
  if (Array.isArray(currentValue) && currentValue.every((v) => typeof v === "string")) {
    return { value: [...currentValue, answer], evidence }; // e.g. skills, bullets, links
  }
  if (typeof currentValue === "string" || currentValue == null) {
    return { value: answer, evidence };
  }
  // Some other structured shape (a single object/entry) — the mock can't safely synthesize a
  // replacement for it, so it leaves the value unchanged rather than writing something that
  // fails validation. The real model gets a path-specific schema for this instead (see
  // section-schema.ts) and doesn't need this fallback.
  return { value: currentValue, evidence };
}
