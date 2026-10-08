// Picks a concrete zod schema for the `value` the update_section tool must return, based on
// which field it's updating. generation.schemas.ts originally typed this as `z.unknown()` —
// which seemed fine until a live run showed the model (or the mock) could return the wrong
// shape for a structured field (e.g. a string pushed into "experience", an array of objects)
// and the merge failing CvContentSchema validation three times before giving up. Giving the
// model an actual JSON Schema for the field it's touching, generated from the SAME zod schemas
// the rest of the app validates against, makes that class of error far less likely instead of
// just handling it more gracefully after the fact.
import { z } from "zod";
import { ExperienceEntrySchema, EducationEntrySchema, ContactSchema } from "../modules/cvs/cv.schemas.js";

const EXPERIENCE_ENTRY_RE = /^experience\[\d+\]$/;
const EXPERIENCE_FIELD_RE = /^experience\[\d+\]\.(company|title|location|startDate|endDate)$/;
const EXPERIENCE_BULLETS_RE = /^experience\[\d+\]\.bullets$/;
const EXPERIENCE_BULLET_RE = /^experience\[\d+\]\.bullets\[\d+\]$/;
const EDUCATION_ENTRY_RE = /^education\[\d+\]$/;
const EDUCATION_FIELD_RE = /^education\[\d+\]\.(institution|degree|field|startDate|endDate)$/;

export function sectionValueSchema(fieldPath: string): z.ZodType {
  if (fieldPath === "experience") return z.array(ExperienceEntrySchema);
  if (EXPERIENCE_ENTRY_RE.test(fieldPath)) return ExperienceEntrySchema;
  if (EXPERIENCE_BULLETS_RE.test(fieldPath)) return z.array(z.string().max(400));
  if (EXPERIENCE_BULLET_RE.test(fieldPath)) return z.string().max(400);
  if (EXPERIENCE_FIELD_RE.test(fieldPath)) return z.string().max(200);

  if (fieldPath === "education") return z.array(EducationEntrySchema);
  if (EDUCATION_ENTRY_RE.test(fieldPath)) return EducationEntrySchema;
  if (EDUCATION_FIELD_RE.test(fieldPath)) return z.string().max(200);

  if (fieldPath === "skills") return z.array(z.string().max(100));
  if (fieldPath === "contact.links") return z.array(z.string().max(300));
  if (fieldPath === "contact") return ContactSchema;
  if (fieldPath.startsWith("contact.")) return z.string().max(200);

  if (fieldPath === "summary") return z.string().max(1200);

  // Unrecognized path shape — fall back to a plain string rather than guessing further.
  return z.string().max(1200);
}
