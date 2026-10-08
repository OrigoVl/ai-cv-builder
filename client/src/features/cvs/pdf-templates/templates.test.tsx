// @vitest-environment node
//
// Actual PDF generation (deflate-compressed content streams via Node's zlib) needs to run in a
// plain Node environment — jsdom's polyfills corrupt the compression step in a way that produces
// a PDF pdfjs can't decompress ("Bad FCHECK in flate stream"), even though the PDF itself is
// otherwise valid. The rest of this client's tests stay on jsdom (vitest.config.ts); this one
// file opts out via the directive above, which Vitest reads before running it.
//
// These templates are hand-synced copies of server/src/pdf/templates/*.tsx (see classic.tsx's
// header for why) — the real risk with that approach is the two copies silently drifting apart.
// This test is what actually guards against that: it renders THIS client copy to a real PDF
// (via @react-pdf/renderer's Node entry point, which Vitest resolves by default — the browser
// entry with PDFViewer is only used at runtime, inside an actual browser) and asserts on its
// extracted text, the same way server/src/pdf/render.test.tsx checks the server's copy. If
// someone edits one copy and forgets the other, this and the server test diverge in what they
// each assert rather than both quietly passing.
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { ClassicTemplate } from "./classic.js";
import { ModernTemplate } from "./modern.js";
import { EMPTY_CV_CONTENT, type CvContent } from "../../../shared/types.js";

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

const SAMPLE_CONTENT: CvContent = {
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
  skills: ["TypeScript"],
};

describe.each([
  ["classic", ClassicTemplate],
  ["modern", ModernTemplate],
] as const)("%s template (client copy)", (_name, Template) => {
  it("renders a single A4 page containing the real content", async () => {
    const buffer = await renderToBuffer(<Template content={SAMPLE_CONTENT} />);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    expect(doc.numPages).toBe(1);
    const page = await doc.getPage(1);
    expect(page.view[2]).toBeCloseTo(595.28, 1); // A4 width in points

    const text = await extractText(buffer);
    expect(text).toContain("Jane Doe");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("Led a team of 5 engineers");
  });

  it("renders an empty CV without throwing", async () => {
    const buffer = await renderToBuffer(<Template content={EMPTY_CV_CONTENT} />);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
