import mammoth from "mammoth";
import { PDFParse, PasswordException } from "pdf-parse";
import type { ResumeFileKind } from "@/lib/resumeFileFormats";

export type ExtractError =
  | { kind: "password_pdf" }
  | { kind: "empty_pdf" }
  | { kind: "bad_docx" }
  | { kind: "empty_docx" };

export async function extractResumeText(
  kind: ResumeFileKind,
  buffer: Buffer,
): Promise<{ text: string } | { error: ExtractError }> {
  if (kind === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      const text = textResult.text?.trim() ?? "";
      if (!text.length) {
        return { error: { kind: "empty_pdf" } };
      }
      return { text };
    } catch (e) {
      const isPassword =
        e instanceof PasswordException ||
        (e instanceof Error && e.name === "PasswordException");
      if (isPassword) {
        return { error: { kind: "password_pdf" } };
      }
      throw e;
    } finally {
      try {
        await parser.destroy();
      } catch {
        /* ignore */
      }
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
