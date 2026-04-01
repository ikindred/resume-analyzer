"use client";

import type { HrCriteria } from "@/lib/hrCriteria";
import type { RankedCandidate } from "@/lib/rankResult";

function wrapLine(
  text: string,
  f: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (f.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function criteriaSummary(c: HrCriteria): string {
  const parts: string[] = [];
  if (c.mustHaveSkills.length)
    parts.push(`Must-have: ${c.mustHaveSkills.join(", ")}`);
  if (c.niceToHaveSkills.length)
    parts.push(`Nice-to-have: ${c.niceToHaveSkills.join(", ")}`);
  if (c.softSkills.length)
    parts.push(`Soft skills: ${c.softSkills.join(", ")}`);
  if (c.personalityTraits.length)
    parts.push(`Culture/personality: ${c.personalityTraits.join(", ")}`);
  if (c.achievements.length)
    parts.push(`Achievements: ${c.achievements.join(", ")}`);
  if (c.schools.length) parts.push(`Schools: ${c.schools.join(", ")}`);
  if (c.minAge != null || c.maxAge != null)
    parts.push(`Age range: ${c.minAge ?? "?"}–${c.maxAge ?? "?"}`);
  if (c.minYearsExperience != null)
    parts.push(`Min years experience: ${c.minYearsExperience}`);
  if (c.maxCompanies != null)
    parts.push(`Max companies: ${c.maxCompanies}`);
  if (c.maxGapMonthsAfterCompany != null)
    parts.push(`Max gap after company (mo): ${c.maxGapMonthsAfterCompany}`);
  if (c.maxGapMonthsAfterGraduation != null)
    parts.push(
      `Max gap after graduation (mo): ${c.maxGapMonthsAfterGraduation}`,
    );
  if (c.notes.trim()) parts.push(`Notes: ${c.notes.trim()}`);
  return parts.length
    ? parts.join(" · ")
    : "No specific criteria (general screening).";
}

export async function downloadRankingPdf(
  criteria: HrCriteria,
  candidates: RankedCandidate[],
  failed: Array<{ fileName: string; error?: string }>,
): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const maxWidth = pageWidth - 2 * margin;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const body = 9;
  const title = 14;
  const sub = 11;
  const gap = 12;

  const ensureSpace = (need: number) => {
    if (y < margin + need) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawTextLines = (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    const lines = text.split(/\n/).flatMap((p) => wrapLine(p, f, size, maxWidth));
    for (const ln of lines) {
      ensureSpace(gap);
      page.drawText(ln, {
        x: margin,
        y,
        size,
        font: f,
        color: rgb(0.1, 0.1, 0.12),
      });
      y -= gap * (size / body);
    }
  };

  ensureSpace(40);
  page.drawText("ResumeIQ — Applicant ranking report", {
    x: margin,
    y,
    size: title,
    font: fontBold,
    color: rgb(0.05, 0.05, 0.08),
  });
  y -= 22;

  drawTextLines(`Generated: ${new Date().toLocaleString()}`, body);
  y -= 4;

  drawTextLines("HR criteria summary", sub, true);
  drawTextLines(criteriaSummary(criteria), body);
  y -= 6;

  drawTextLines("Ranked candidates", sub, true);
  y -= 4;

  for (const c of candidates) {
    const a = c.analysis;
    const interview =
      a.recommendation === "Strong Candidate" ||
      a.recommendation === "Consider for Interview"
        ? "Interview: Yes"
        : "Interview: No";

    drawTextLines(
      `${c.rank}. ${a.candidateName || "Unknown"} — Score ${c.rankScore.toFixed(1)} / 100 · ${interview} · ${a.recommendation}`,
      body,
      true,
    );
    drawTextLines(`File: ${c.fileName}`, body);
    const topGood = (a.goodThings ?? []).slice(0, 2).join("; ");
    const topBad = (a.badThings ?? []).slice(0, 2).join("; ");
    if (topGood) drawTextLines(`Good: ${topGood}`, body);
    if (topBad) drawTextLines(`Risks: ${topBad}`, body);
    const just = a.assessment.justification;
    drawTextLines(
      `Fit: ${a.assessment.fitScore}/10 — ${just.slice(0, 360)}${just.length > 360 ? "…" : ""}`,
      body,
    );
    y -= 6;
  }

  if (failed.length) {
    drawTextLines("Could not process", sub, true);
    for (const f of failed) {
      drawTextLines(`• ${f.fileName}: ${f.error ?? "Error"}`, body);
    }
  }

  const bytes = await pdf.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resumeiq-ranking-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
