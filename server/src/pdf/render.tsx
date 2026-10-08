import { renderToBuffer } from "@react-pdf/renderer";
import type { CvContent } from "../modules/cvs/cv.schemas.js";
import { CvDocument } from "./cv-document.js";

/** Renders the CV's *currently saved* content — never anything passed in from a request body —
 * so this endpoint can't be used to smuggle arbitrary content into a PDF response. */
export async function renderCvPdf(content: CvContent): Promise<Buffer> {
  return renderToBuffer(<CvDocument content={content} />);
}
