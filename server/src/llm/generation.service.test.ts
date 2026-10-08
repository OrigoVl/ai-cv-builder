// LLM_MOCK=true is set globally in test/setup.ts, so these exercise the real mock → grounding
// pipeline end-to-end without a network call — the same code path the generate job handler uses.
import { describe, expect, it } from "vitest";
import { generateCv, updateSection } from "./generation.service.js";
import { CvContentSchema } from "../modules/cvs/cv.schemas.js";

describe("generateCv (mock mode)", () => {
  it("extracts contact details and asks a question instead of inventing experience", async () => {
    const outcome = await generateCv("Jane Doe\njane@example.com\n+1 555 000 1111", "Backend Engineer");

    expect(outcome.cv.contact.name).toBe("Jane Doe");
    expect(outcome.cv.contact.email).toBe("jane@example.com");
    expect(outcome.cv.experience).toEqual([]);
    expect(outcome.questions.length).toBeGreaterThan(0);
    expect(outcome.issues).toHaveLength(0); // mock output is grounded by construction
  });
});

describe("updateSection (mock mode)", () => {
  it("merges the user's answer into the field and reports it as grounded", async () => {
    const outcome = await updateSection({
      fieldPath: "skills",
      currentValue: ["Node.js"],
      question: "Any other key skills?",
      answer: "I also have strong Kubernetes experience",
      sourceText: "Jane Doe, backend engineer",
      priorAnswers: [],
    });

    expect(outcome.grounded).toBe(true);
    expect(outcome.value).toEqual(["Node.js", "I also have strong Kubernetes experience"]);
  });

  // Regression test: answering generateCv's own default question ("add your experience
  // manually?", fieldPath "experience") used to push a raw string into an array that must
  // validate as ExperienceEntry[], which failed CvContentSchema three times before the job gave
  // up silently. Caught by actually running the flow end-to-end against a live container, not
  // by a unit test — this one exists so it can't regress unnoticed.
  it("produces a structured entry (not a raw string) when answering the default 'add experience' question", async () => {
    const outcome = await updateSection({
      fieldPath: "experience",
      currentValue: [],
      question: "Add your experience manually?",
      answer: "Senior Backend Engineer at Acme Corp, 2019-2022",
      sourceText: "Jane Doe",
      priorAnswers: [],
    });

    expect(outcome.grounded).toBe(true);
    const merged = CvContentSchema.safeParse({
      contact: { name: "", email: "", phone: "", location: "", links: [] },
      summary: "",
      experience: outcome.value,
      education: [],
      skills: [],
    });
    expect(merged.success).toBe(true);
  });
});
