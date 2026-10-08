// Untrusted-input handling for the one file type this app accepts uploads of — exactly the kind
// of path the task brief calls out ("how you handle failures and untrusted input"), so it gets
// its own focused coverage rather than relying on the happy path exercised elsewhere.
import { describe, expect, it } from "vitest";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { extractPdfText } from "./pdf-extract.service.js";

async function makePdf(pages: string[]): Promise<Buffer> {
  return renderToBuffer(
    <Document>
      {pages.map((text, i) => (
        <Page key={i} size="A4">
          <Text>{text}</Text>
        </Page>
      ))}
    </Document>,
  );
}

async function makeTextlessPdf(): Promise<Buffer> {
  // A real, validly-structured PDF with a page but no text operators at all — the direct
  // equivalent of a scanned image with no OCR layer, without needing to embed an actual image.
  return renderToBuffer(
    <Document>
      <Page size="A4">
        <View />
      </Page>
    </Document>,
  );
}

describe("extractPdfText", () => {
  it("extracts the real text content of a normal PDF", async () => {
    const buffer = await makePdf(["Jane Doe, Senior Backend Engineer with 7 years of experience building systems."]);
    const text = await extractPdfText(buffer);
    expect(text).toContain("Jane Doe");
    expect(text).toContain("Senior Backend Engineer");
  });

  it("rejects a scanned-style PDF with no selectable text (422, not a silent empty result)", async () => {
    const buffer = await makeTextlessPdf();
    await expect(extractPdfText(buffer)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("scanned image"),
    });
  });

  it("rejects a corrupted/unparseable PDF (422, not a 500)", async () => {
    const buffer = Buffer.from("%PDF-1.4\nthis is not a real pdf object structure at all\n%%EOF");
    await expect(extractPdfText(buffer)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("Could not read this PDF"),
    });
  });

  it("caps extraction at the first 10 pages rather than reading an unbounded file", async () => {
    const pages = Array.from({ length: 15 }, (_, i) => `PAGE_${i + 1}_MARKER padding text to stay above the minimum`);
    const buffer = await makePdf(pages);
    const text = await extractPdfText(buffer);
    expect(text).toContain("PAGE_1_MARKER");
    expect(text).toContain("PAGE_10_MARKER");
    expect(text).not.toContain("PAGE_11_MARKER");
    expect(text).not.toContain("PAGE_15_MARKER");
  });
});
