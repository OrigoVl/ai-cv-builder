import { HttpError } from "../../core/http.js";

const MAX_PAGES = 10;
const MIN_USABLE_TEXT_LENGTH = 40;

/**
 * Pulls the text layer out of an uploaded PDF. Capped at MAX_PAGES so a huge or malicious file
 * can't tie up the request indefinitely. A scanned CV (image-only, no text layer) comes back
 * with little or no text — rather than feeding that near-empty string to the LLM and getting a
 * confusing result, we fail fast with a message that tells the user what to do instead.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch {
    throw new HttpError(422, "Could not read this PDF. It may be corrupted — try a different file.");
  }

  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  let text = "";
  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
  }
  text = text.trim();

  if (text.length < MIN_USABLE_TEXT_LENGTH) {
    throw new HttpError(
      422,
      "This PDF doesn't have selectable text (it may be a scanned image). Please paste your CV as text instead.",
    );
  }

  return text;
}
