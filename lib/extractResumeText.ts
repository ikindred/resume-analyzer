import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { ResumeFileKind } from "@/lib/resumeFileFormats";

export type ExtractError =
  | { kind: "password_pdf" }
  | { kind: "empty_pdf" }
  | { kind: "bad_docx" }
  | { kind: "empty_docx" };

/** Classification of PDF text extraction quality (unpdf text layer). */
export type ResumePdfTextKind = "full-text" | "image-only";

export type ExtractResumeTextOptions = {
  /**
   * When true and the PDF has no extractable text, return success with empty
   * string and `pdfTextKind: "image-only"` so the analyze route can run OCR.
   * Omit for callers (e.g. rank) that should keep receiving `empty_pdf`.
   */
  preserveEmptyPdfForOcr?: boolean;
};

export function classifyResumeText(text: string): ResumePdfTextKind {
  return text.trim().length < 100 ? "image-only" : "full-text";
}

function isPasswordPdfError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (e.name === "PasswordException") return true;
  return /need a password|incorrect password|no password given|password required/i.test(
    e.message,
  );
}

export async function extractResumeText(
  kind: ResumeFileKind,
  buffer: Buffer,
  options?: ExtractResumeTextOptions,
): Promise<
  | { text: string; pdfTextKind?: ResumePdfTextKind }
  | { error: ExtractError }
> {
  if (kind === "pdf") {
    try {
      const { text } = await extractText(new Uint8Array(buffer), {
        mergePages: true,
      });
      const trimmed = text?.trim() ?? "";
      const pdfTextKind = classifyResumeText(trimmed);

      if (!trimmed.length) {
        if (options?.preserveEmptyPdfForOcr) {
          return { text: "", pdfTextKind: "image-only" };
        }
        return { error: { kind: "empty_pdf" } };
      }

      return { text: trimmed, pdfTextKind };
    } catch (e) {
      if (isPasswordPdfError(e)) {
        return { error: { kind: "password_pdf" } };
      }
      throw e;
    }
  }

  try {
    const raw = await mammoth.extractRawText({ buffer });
    const text = raw.value?.trim() ?? "";
    if (!text.length) {
      return { error: { kind: "empty_docx" } };
    }
    return { text };
  } catch {
    return { error: { kind: "bad_docx" } };
  }
}
