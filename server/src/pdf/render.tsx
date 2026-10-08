import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { CvContent, CvTemplate } from "../modules/cvs/cv.schemas.js";
import { ClassicTemplate } from "./templates/classic.js";
import { ModernTemplate } from "./templates/modern.js";

const TEMPLATES: Record<CvTemplate, (props: { content: CvContent }) => ReactElement> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
};

/** Renders the CV's *currently saved* content — never anything passed in from a request body —
 * so this endpoint can't be used to smuggle arbitrary content into a PDF response. */
export async function renderCvPdf(content: CvContent, template: CvTemplate = "classic"): Promise<Buffer> {
  const Template = TEMPLATES[template];
  return renderToBuffer(<Template content={content} />);
}
