// sectionValueSchema's whole job is picking the right shape for an arbitrary field_path string —
// get the regex wrong and update_section either rejects a legitimate model response or, worse,
// accepts the wrong shape under the catch-all string fallback and corrupts the merge. Each case
// below asserts both that the right kind of value is accepted AND that a value from a
// neighboring/wrong case is rejected, so a too-loose regex (e.g. one missing `^`/`$`) would fail.
import { describe, expect, it } from "vitest";
import { sectionValueSchema } from "./section-schema.js";

function accepts(fieldPath: string, value: unknown) {
  expect(sectionValueSchema(fieldPath).safeParse(value).success).toBe(true);
}

function rejects(fieldPath: string, value: unknown) {
  expect(sectionValueSchema(fieldPath).safeParse(value).success).toBe(false);
}

describe("sectionValueSchema", () => {
  it("experience (whole array) accepts an array of entries, rejects a single entry", () => {
    accepts("experience", [{ company: "Acme" }]);
    rejects("experience", { company: "Acme" });
  });

  it("experience[N] (one entry) accepts an entry object, rejects an array", () => {
    accepts("experience[0]", { company: "Acme", title: "Engineer" });
    accepts("experience[12]", { company: "Acme" });
    rejects("experience[0]", [{ company: "Acme" }]);
    rejects("experience[0]", "Acme");
  });

  it("experience[N].bullets (the array) accepts a string array, rejects a single string", () => {
    accepts("experience[0].bullets", ["Shipped the thing", "Led the team"]);
    rejects("experience[0].bullets", "Shipped the thing");
  });

  it("experience[N].bullets[M] (one bullet) accepts a string, rejects an array", () => {
    accepts("experience[0].bullets[3]", "Shipped the thing");
    rejects("experience[0].bullets[3]", ["Shipped the thing"]);
  });

  it("experience[N].<scalar field> accepts a string, rejects an object", () => {
    for (const field of ["company", "title", "location", "startDate", "endDate"]) {
      accepts(`experience[2].${field}`, "some value");
      rejects(`experience[2].${field}`, { nested: true });
    }
  });

  it("education (whole array) accepts an array of entries, rejects a single entry", () => {
    accepts("education", [{ institution: "MIT" }]);
    rejects("education", { institution: "MIT" });
  });

  it("education[N] (one entry) accepts an entry object", () => {
    accepts("education[0]", { institution: "MIT", degree: "BSc" });
    rejects("education[0]", [{ institution: "MIT" }]);
  });

  it("education[N].<scalar field> accepts a string", () => {
    for (const field of ["institution", "degree", "field", "startDate", "endDate"]) {
      accepts(`education[1].${field}`, "some value");
      rejects(`education[1].${field}`, { nested: true });
    }
  });

  it("skills accepts a string array, rejects a single string", () => {
    accepts("skills", ["TypeScript", "Postgres"]);
    rejects("skills", "TypeScript");
  });

  it("contact.links accepts a string array, rejects a single string", () => {
    accepts("contact.links", ["https://example.com"]);
    rejects("contact.links", "https://example.com");
  });

  it("contact (whole object) accepts a full contact object, rejects a bare string", () => {
    accepts("contact", { name: "Jane", email: "jane@example.com", phone: "", location: "", links: [] });
    rejects("contact", "jane@example.com");
  });

  it("contact.<field> (anything but links) falls back to a plain string", () => {
    accepts("contact.email", "jane@example.com");
    accepts("contact.name", "Jane Doe");
  });

  it("summary accepts a string", () => {
    accepts("summary", "A senior engineer with 7 years of experience.");
  });

  it("falls back to a plain string for an unrecognized path shape", () => {
    accepts("something.unexpected[0]", "a string is still fine");
    accepts("", "even an empty path falls back rather than throwing");
  });

  it("enforces the same max-length caps as the full CvContentSchema field", () => {
    rejects("summary", "x".repeat(1201));
    rejects("experience[0].bullets[0]", "x".repeat(401));
    rejects("skills", ["x".repeat(101)]);
  });
});
