// Deterministic, non-LLM fact check run on every generation and section-update result before it
// reaches the stored CV. This is the actual enforcement of "the AI may rephrase but must not
// invent facts" — the system prompt (prompts.ts) ASKS the model to stick to the source and cite
// evidence, but nothing stops a model from ignoring that, so every entity name, date and number
// it produces is independently checked against the source text (+ any answers the user has given)
// here, in plain code, with unit tests (grounding.test.ts) as the actual guarantee.
//
// Policy: rephrasing prose is fine and not checked (we can't "verify" a paraphrase). Anything
// that reads as a hard fact — a company/school name, a title, a date, a number, an email, a
// phone, a URL — must appear (verbatim-ish) in the trusted corpus. If it doesn't, the field is
// removed/blanked rather than shipped silently, and a question is raised so the user can confirm
// or supply it themselves.
import type { CvContent, ExperienceEntry, EducationEntry } from "../modules/cvs/cv.schemas.js";
import type { GenerationResult, GeneratedQuestion, EvidenceItem } from "./generation.schemas.js";

export interface GroundingIssue {
  path: string;
  reason: "invented-fact" | "invented-entity" | "unverified-quote";
  value: string;
}

export interface GroundingOutcome {
  cv: CvContent;
  questions: GeneratedQuestion[];
  issues: GroundingIssue[];
}

// --- text matching helpers --------------------------------------------------------------------

// U+0300-U+036F is the Unicode "Combining Diacritical Marks" block — what NFKD decomposition
// splits accented letters into (e.g. "é" -> "e" + U+0301). Stripping that range after NFKD is
// the standard way to fold accents for comparison, so "café" and "cafe" match.
const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS_RE, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Loose "does this entity name occur in the corpus" check — tolerant of punctuation and minor
 * suffix differences ("Google" vs "Google LLC"), but requires most significant words to match. */
export function fuzzyContains(needle: string, haystackLower: string): boolean {
  const words = normalizeWords(needle).filter((w) => w.length >= 3);
  if (words.length === 0) return true; // nothing meaningful (e.g. all short/stop words) to check
  const matched = words.filter((w) => haystackLower.includes(w));
  return matched.length / words.length >= 0.8;
}

const FACTUAL_TOKEN_PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email
  /https?:\/\/\S+/gi, // url with scheme
  /\b(?:19|20)\d{2}\b/g, // 4-digit years
  /\+?\d[\d\-\s()]{6,}\d/g, // phone-ish
  /\b\d+(?:[.,]\d+)?\s*(?:%|percent)\b/gi, // percentages
  /\$\s?\d+(?:[.,]\d+)?\s*[kmb]?\b/gi, // money
  /\b\d{2,}\b/g, // any other multi-digit number (counts, team sizes, etc.)
];

/** Pulls out everything in `text` that reads as a checkable hard fact (number, date, email,
 * phone, URL). Plain prose with no such tokens returns an empty array, meaning "nothing to
 * verify" — intentional, since rephrased prose with no numbers can't be fact-checked this way. */
export function extractFactualTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const pattern of FACTUAL_TOKEN_PATTERNS) {
    for (const match of text.matchAll(pattern)) tokens.add(match[0]);
  }
  return [...tokens];
}

function tokenNormalize(tok: string): string {
  return tok.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Every factual token in `text` must literally occur in the (already-lowercased) corpus. */
export function allTokensGrounded(text: string, corpusLower: string): boolean {
  return extractFactualTokens(text).every((tok) => corpusLower.includes(tokenNormalize(tok)));
}

/** Recursive version of the token check for arbitrary (string | array | object) values — used by
 * the apply-answer job, which gets back a single field's replacement value of unknown shape
 * rather than a full CvContent this module otherwise knows how to walk field-by-field. */
export function isValueGrounded(value: unknown, corpusLower: string): boolean {
  if (typeof value === "string") return allTokensGrounded(value, corpusLower);
  if (Array.isArray(value)) return value.every((v) => isValueGrounded(v, corpusLower));
  if (value && typeof value === "object") {
    return Object.values(value).every((v) => isValueGrounded(v, corpusLower));
  }
  return true;
}

// --- the checker -------------------------------------------------------------------------------

export function checkGrounding(
  result: GenerationResult,
  sourceText: string,
  answers: string[] = [],
): GroundingOutcome {
  const corpusLower = [sourceText, ...answers].join("\n").toLowerCase();
  const evidenceByPath = new Map<string, EvidenceItem[]>();
  for (const e of result.evidence) {
    evidenceByPath.set(e.path, [...(evidenceByPath.get(e.path) ?? []), e]);
  }

  const issues: GroundingIssue[] = [];
  const cv: CvContent = structuredClone(result.cv);

  function flag(path: string, reason: GroundingIssue["reason"], value: string): void {
    issues.push({ path, reason, value });
  }

  /** A quote was cited as evidence for `path` — if present, at least one of its quotes must be
   * found in the corpus or the claim is unverified regardless of what the field text itself is. */
  function evidenceOk(path: string): boolean {
    const items = evidenceByPath.get(path);
    if (!items || items.length === 0) return true; // no evidence cited — judged on its own merits
    return items.some((e) => corpusLower.includes(tokenNormalize(e.quote)) || fuzzyContains(e.quote, corpusLower));
  }

  /** Hard-fact field (a name/title/date): must fuzzy-match the corpus AND have grounded tokens
   * AND have grounded evidence (if any was cited). Blanks the field and raises a question on
   * failure. Returns the (possibly blanked) value. */
  function checkEntityField(path: string, value: string): string {
    if (!value.trim()) return value;
    if (!fuzzyContains(value, corpusLower)) {
      flag(path, "invented-entity", value);
      return "";
    }
    if (!allTokensGrounded(value, corpusLower)) {
      flag(path, "invented-fact", value);
      return "";
    }
    if (!evidenceOk(path)) {
      flag(path, "unverified-quote", value);
      return "";
    }
    return value;
  }

  /** Free-text field (a bullet, the summary): only the hard-fact tokens inside it are checked,
   * since the prose around them is an allowed paraphrase. `null` return means "drop this item". */
  function checkFreeTextField(path: string, value: string): string | null {
    if (!value.trim()) return value;
    if (!allTokensGrounded(value, corpusLower)) {
      flag(path, "invented-fact", value);
      return null;
    }
    if (!evidenceOk(path)) {
      flag(path, "unverified-quote", value);
      return null;
    }
    return value;
  }

  // contact ---------------------------------------------------------------------------------
  cv.contact.name = checkEntityField("contact.name", cv.contact.name);
  if (cv.contact.email && !allTokensGrounded(cv.contact.email, corpusLower)) {
    flag("contact.email", "invented-fact", cv.contact.email);
    cv.contact.email = "";
  }
  if (cv.contact.phone && !allTokensGrounded(cv.contact.phone, corpusLower)) {
    flag("contact.phone", "invented-fact", cv.contact.phone);
    cv.contact.phone = "";
  }
  cv.contact.links = cv.contact.links.filter((link, i) => {
    const ok = allTokensGrounded(link, corpusLower) || fuzzyContains(link, corpusLower);
    if (!ok) flag(`contact.links[${i}]`, "invented-fact", link);
    return ok;
  });

  // summary: free text, token-checked only ---------------------------------------------------
  const summaryChecked = checkFreeTextField("summary", cv.summary);
  cv.summary = summaryChecked ?? "";

  // experience --------------------------------------------------------------------------------
  cv.experience = cv.experience
    .map((entry: ExperienceEntry, i: number): ExperienceEntry => {
      const path = `experience[${i}]`;
      const company = checkEntityField(`${path}.company`, entry.company);
      const title = checkEntityField(`${path}.title`, entry.title);
      const startDate = entry.startDate && !allTokensGrounded(entry.startDate, corpusLower) ? "" : entry.startDate;
      if (startDate !== entry.startDate) flag(`${path}.startDate`, "invented-fact", entry.startDate);
      const endDate =
        entry.endDate && entry.endDate.toLowerCase() !== "present" && !allTokensGrounded(entry.endDate, corpusLower)
          ? ""
          : entry.endDate;
      if (endDate !== entry.endDate) flag(`${path}.endDate`, "invented-fact", entry.endDate);
      const bullets = entry.bullets
        .map((b, j) => checkFreeTextField(`${path}.bullets[${j}]`, b))
        .filter((b): b is string => b !== null);
      return { ...entry, company, title, startDate, endDate, bullets };
    })
    // an entry that lost its company to an invented-entity check is no longer a verifiable job —
    // drop it entirely rather than show a blank employer with real-looking dates and bullets.
    .filter((entry) => entry.company.trim().length > 0);

  // education -----------------------------------------------------------------------------
  cv.education = cv.education
    .map((entry: EducationEntry, i: number): EducationEntry => {
      const path = `education[${i}]`;
      const institution = checkEntityField(`${path}.institution`, entry.institution);
      const degree = checkFreeTextField(`${path}.degree`, entry.degree) ?? "";
      const field = checkFreeTextField(`${path}.field`, entry.field) ?? "";
      const startDate = entry.startDate && !allTokensGrounded(entry.startDate, corpusLower) ? "" : entry.startDate;
      if (startDate !== entry.startDate) flag(`${path}.startDate`, "invented-fact", entry.startDate);
      const endDate = entry.endDate && !allTokensGrounded(entry.endDate, corpusLower) ? "" : entry.endDate;
      if (endDate !== entry.endDate) flag(`${path}.endDate`, "invented-fact", entry.endDate);
      return { ...entry, institution, degree, field, startDate, endDate };
    })
    .filter((entry) => entry.institution.trim().length > 0);

  // skills: each must fuzzy-occur in the corpus ------------------------------------------------
  cv.skills = cv.skills.filter((skill, i) => {
    const ok = fuzzyContains(skill, corpusLower);
    if (!ok) flag(`skills[${i}]`, "invented-entity", skill);
    return ok;
  });

  // --- turn issues into user-facing questions, merged with the model's own ---------------------
  const autoQuestions: GeneratedQuestion[] = issues.map((issue) => ({
    fieldPath: issue.path,
    question: `We couldn't verify "${issue.value}" against your source — can you confirm or fill it in?`,
    reason: `Automated fact check flagged this as ${issue.reason.replace("-", " ")}.`,
  }));

  const seen = new Set<string>();
  const questions: GeneratedQuestion[] = [];
  for (const q of [...result.questions, ...autoQuestions]) {
    const key = `${q.fieldPath}::${q.question}`;
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(q);
  }

  return { cv, questions, issues };
}
