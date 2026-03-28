/** PDF plus Word .docx (Microsoft Word & Google Docs “Download as .docx”). */

export type ResumeFileKind = "pdf" | "docx";

export function getResumeFileKind(file: File): ResumeFileKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  return null;
}
