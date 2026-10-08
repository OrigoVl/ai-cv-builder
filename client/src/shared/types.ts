// Mirrors the server's zod schemas (server/src/modules/cvs/cv.schemas.ts) as plain TS types —
// the client doesn't share a package with the server, so these are kept in sync by hand. Small
// enough surface that this is simpler than setting up a shared workspace package for one file.
export interface Contact {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
}

export interface ExperienceEntry {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface CvContent {
  contact: Contact;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: string[];
}

export const EMPTY_CV_CONTENT: CvContent = {
  contact: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  skills: [],
};

export type CvStatus = "draft" | "generating" | "ready" | "failed";
export type CvTemplate = "classic" | "modern";

export interface Cv {
  id: string;
  userId: string;
  title: string;
  targetRole: string;
  sourceKind: "pdf" | "text";
  status: CvStatus;
  error: string | null;
  content: CvContent | null;
  template: CvTemplate;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type QuestionStatus = "open" | "answered" | "dismissed";

export interface CvQuestion {
  id: string;
  cvId: string;
  fieldPath: string;
  question: string;
  reason: string | null;
  answer: string | null;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
}
