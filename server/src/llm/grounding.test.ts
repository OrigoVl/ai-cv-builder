import { describe, expect, it } from "vitest";
import { checkGrounding, fuzzyContains, extractFactualTokens } from "./grounding.js";
import { EMPTY_CV_CONTENT } from "../modules/cvs/cv.schemas.js";
import type { GenerationResult } from "./generation.schemas.js";

const SOURCE = `
Jane Doe
jane@example.com
+1 555 123 4567

Senior Backend Engineer at Acme Corp, 2019 - 2022.
Led a team of 5 engineers and reduced API latency by 30%.

Education: BSc Computer Science, State University, 2015 - 2019.
`;

function baseResult(overrides: Partial<GenerationResult["cv"]> = {}): GenerationResult {
  return {
    cv: { ...EMPTY_CV_CONTENT, ...overrides },
    evidence: [],
    questions: [],
  };
}

describe("extractFactualTokens", () => {
  it("finds emails, years, percentages and phone numbers", () => {
    const tokens = extractFactualTokens("Reached jane@example.com in 2022, grew revenue 30%, call +1 555 123 4567");
    expect(tokens).toContain("jane@example.com");
    expect(tokens).toContain("2022");
    expect(tokens.some((t) => t.includes("30"))).toBe(true);
  });

  it("returns nothing for plain prose", () => {
    expect(extractFactualTokens("Led a talented team with great communication skills")).toEqual([]);
  });
});

describe("fuzzyContains", () => {
  it("matches an entity name even with a suffix difference", () => {
    expect(fuzzyContains("Acme Corp", "... worked at acme corp inc as an engineer ...")).toBe(true);
  });

  it("rejects an entity that never appears", () => {
    expect(fuzzyContains("Globex Corporation", "... worked at acme corp ...")).toBe(false);
  });
});

describe("checkGrounding", () => {
  it("passes through facts that are genuinely in the source", () => {
    const result = baseResult({
      contact: { name: "Jane Doe", email: "jane@example.com", phone: "+1 555 123 4567", location: "", links: [] },
      experience: [
        {
          company: "Acme Corp",
          title: "Senior Backend Engineer",
          location: "",
          startDate: "2019",
          endDate: "2022",
          bullets: ["Led a team of 5 engineers and reduced API latency by 30%"],
        },
      ],
      education: [{ institution: "State University", degree: "BSc", field: "Computer Science", startDate: "2015", endDate: "2019" }],
    });

    const outcome = checkGrounding(result, SOURCE);

    expect(outcome.cv.contact.email).toBe("jane@example.com");
    expect(outcome.cv.experience).toHaveLength(1);
    expect(outcome.cv.experience[0]?.bullets).toHaveLength(1);
    expect(outcome.cv.education).toHaveLength(1);
    expect(outcome.issues).toHaveLength(0);
  });

  it("strips an invented employer and raises a question instead of shipping it silently", () => {
    const result = baseResult({
      experience: [
        {
          company: "Globex Corporation", // not in the source at all
          title: "Senior Backend Engineer",
          location: "",
          startDate: "2019",
          endDate: "2022",
          bullets: ["Led a team of 5 engineers"],
        },
      ],
    });

    const outcome = checkGrounding(result, SOURCE);

    expect(outcome.cv.experience).toHaveLength(0); // dropped: no verifiable employer
    expect(outcome.issues.some((i) => i.reason === "invented-entity")).toBe(true);
    expect(outcome.questions.some((q) => q.fieldPath === "experience[0].company")).toBe(true);
  });

  it("strips a bullet with an invented metric but keeps the rest of the entry", () => {
    const result = baseResult({
      experience: [
        {
          company: "Acme Corp",
          title: "Senior Backend Engineer",
          location: "",
          startDate: "2019",
          endDate: "2022",
          bullets: [
            "Led a team of 5 engineers and reduced API latency by 30%", // grounded
            "Grew annual revenue by 400% through new partnerships", // invented number
          ],
        },
      ],
    });

    const outcome = checkGrounding(result, SOURCE);

    expect(outcome.cv.experience[0]?.bullets).toEqual(["Led a team of 5 engineers and reduced API latency by 30%"]);
    expect(outcome.issues.some((i) => i.reason === "invented-fact" && i.value.includes("400%"))).toBe(true);
  });

  it("allows pure rephrasing with no factual tokens", () => {
    const result = baseResult({
      experience: [
        {
          company: "Acme Corp",
          title: "Senior Backend Engineer",
          location: "",
          startDate: "2019",
          endDate: "2022",
          bullets: ["Directed engineering staff and improved system performance"], // rephrase, no numbers
        },
      ],
    });

    const outcome = checkGrounding(result, SOURCE);
    expect(outcome.cv.experience[0]?.bullets).toHaveLength(1);
  });

  it("allows a fact that only appears in a user-supplied answer, not the original source", () => {
    const result = baseResult({ skills: ["Kubernetes"] });
    const withoutAnswer = checkGrounding(result, SOURCE, []);
    const withAnswer = checkGrounding(result, SOURCE, ["I also have 3 years of Kubernetes experience"]);

    expect(withoutAnswer.cv.skills).toEqual([]);
    expect(withAnswer.cv.skills).toEqual(["Kubernetes"]);
  });

  it("rejects evidence whose quote cannot be found in the source", () => {
    const result: GenerationResult = {
      cv: {
        ...EMPTY_CV_CONTENT,
        experience: [
          {
            company: "Acme Corp",
            title: "Senior Backend Engineer",
            location: "",
            startDate: "2019",
            endDate: "2022",
            bullets: ["Owned budget planning for the engineering org"], // no factual tokens of its own
          },
        ],
      },
      evidence: [{ path: "experience[0].bullets[0]", quote: "This sentence does not appear anywhere in the source" }],
      questions: [],
    };

    const outcome = checkGrounding(result, SOURCE);
    expect(outcome.cv.experience[0]?.bullets).toHaveLength(0);
    expect(outcome.issues.some((i) => i.reason === "unverified-quote")).toBe(true);
  });

  it("drops an invented skill", () => {
    const result = baseResult({ skills: ["Kubernetes", "Python"] }); // neither in SOURCE
    const outcome = checkGrounding(result, SOURCE);
    expect(outcome.cv.skills).toEqual([]);
  });

  it("merges the model's own questions with auto-generated ones without duplicating", () => {
    const result = baseResult({ skills: ["Kubernetes"] });
    result.questions = [{ fieldPath: "contact.location", question: "What city are you based in?", reason: "missing" }];

    const outcome = checkGrounding(result, SOURCE);
    expect(outcome.questions).toHaveLength(2);
    expect(outcome.questions.some((q) => q.fieldPath === "contact.location")).toBe(true);
    expect(outcome.questions.some((q) => q.fieldPath === "skills[0]")).toBe(true);
  });
});
