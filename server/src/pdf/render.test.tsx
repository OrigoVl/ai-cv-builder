import { describe, expect, it } from "vitest";
import { renderCvPdf } from "./render.js";
import { EMPTY_CV_CONTENT } from "../modules/cvs/cv.schemas.js";

async function extractText(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
  }
  return text;
}

describe("renderCvPdf", () => {
  it("produces a single A4 page with selectable text containing the CV's content", async () => {
    const content = {
      ...EMPTY_CV_CONTENT,
      contact: { name: "Jane Doe", email: "jane@example.com", phone: "", location: "Berlin", links: [] },
      summary: "Backend engineer focused on reliability.",
      experience: [
        {
          company: "Acme Corp",
          title: "Senior Backend Engineer",
          location: "",
          startDate: "2019",
          endDate: "2022",
          bullets: ["Led a team of 5 engineers"],
        },
      ],
      education: [],
      skills: ["TypeScript", "PostgreSQL"],
    };

    const buffer = await renderCvPdf(content);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-"); // real PDF, not an image

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    expect(doc.numPages).toBe(1);

    const page = await doc.getPage(1);
    expect(page.view[2]).toBeCloseTo(595.28, 1); // A4 width in points
    expect(page.view[3]).toBeCloseTo(841.89, 1); // A4 height in points

    const text = await extractText(buffer);
    expect(text).toContain("Jane Doe");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("Led a team of 5 engineers");
    expect(text).toContain("TypeScript");
  });

  it("renders an empty CV without throwing", async () => {
    const buffer = await renderCvPdf(EMPTY_CV_CONTENT);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
