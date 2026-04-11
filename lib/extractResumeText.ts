import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { ResumeFileKind } from "@/lib/resumeFileFormats";

export type ExtractError =
  | { kind: "password_pdf" }
  | { kind: "empty_pdf" }
  | { kind: "bad_docx" }
  | { kind: "empty_docx" };

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
): Promise<{ text: string } | { error: ExtractError }> {
  if (kind === "pdf") {
    try {
      const { text } = await extractText(new Uint8Array(buffer), {
        mergePages: true,
      });
      const trimmed = text?.trim() ?? "";
      if (!trimmed.length) {
        return { error: { kind: "empty_pdf" } };
      }
      return { text: trimmed };
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
