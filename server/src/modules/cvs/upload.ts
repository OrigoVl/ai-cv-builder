import multer from "multer";
import { badRequest } from "../../core/http.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      cb(badRequest("Only PDF uploads are supported"));
      return;
    }
    cb(null, true);
  },
}).single("file");

/** multer's fileFilter only looks at the client-supplied MIME type, which is trivially spoofable
 * — this checks the actual magic bytes (`%PDF-`) before we hand the buffer to pdfjs. */
export function assertLooksLikePdf(buffer: Buffer): void {
  const header = buffer.subarray(0, 5).toString("latin1");
  if (header !== "%PDF-") {
    throw badRequest("The uploaded file is not a valid PDF");
  }
}
