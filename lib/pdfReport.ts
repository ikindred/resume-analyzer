"use client";

import type { HrCriteria } from "@/lib/hrCriteria";
import type { RankedCandidate } from "@/lib/rankResult";
import type { CertificateEntry, ResumeAnalysis } from "@/lib/analyzeResume";
import {
  effectiveJobResponsibilities,
  safeCertificateArray,
} from "@/lib/analyzeResume";

const LETTERHEAD_URL = "/letterhead.pdf";
/** Body text starts this many points below the top when a letterhead is used (clears logo/header art). */
const LETTERHEAD_TOP_RESERVE_PTS = 135;

const FALLBACK_PAGE_W = 595.28;
const FALLBACK_PAGE_H = 841.89;

/** Standard document line height (1.5 = 150% leading). */
const LINE_HEIGHT = 1.5;

/** Point sizes for pdf-lib reports (Helvetica). */
const PDF_PT_BODY = 11;
const PDF_PT_SUBHEADING = 13;
const PDF_PT_TITLE = 17;
/** Vertical drop after the main report title (title size + gap). */
const PDF_TITLE_BLOCK_PTS = 28;

function lineAdvancePts(size: number): number {
  return size * LINE_HEIGHT;
}

/**
 * pdf-lib StandardFonts (Helvetica) use WinAnsi only; Unicode bullets/dashes throw
 * "WinAnsi cannot encode" when measuring or drawing text.
 */
function sanitizePdfWinAnsi(text: string): string {
  return text
    .replace(/\u25cf/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u2043/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2000-\u200f\ufeff]/g, " ")
    .replace(/\u2713/g, "")
    .replace(/\u2714/g, "")
    .replace(/\u2611/g, "");
}

function wrapLine(
  text: string,
  f: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const safe = sanitizePdfWinAnsi(text);
  const words = safe.split(/\s+/).filter(Boolean);
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

async function loadLetterheadTemplate(): Promise<
  import("pdf-lib").PDFDocument | null
> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const res = await fetch(LETTERHEAD_URL);
    if (!res.ok) return null;
    return PDFDocument.load(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function addPageWithLetterhead(
  pdf: import("pdf-lib").PDFDocument,
  letterhead: import("pdf-lib").PDFDocument | null,
): Promise<{ page: import("pdf-lib").PDFPage; width: number; height: number }> {
  if (letterhead) {
    const [copied] = await pdf.copyPages(letterhead, [0]);
    pdf.addPage(copied);
    const page = pdf.getPage(pdf.getPageCount() - 1);
    const { width, height } = page.getSize();
    return { page, width, height };
  }
  pdf.addPage([FALLBACK_PAGE_W, FALLBACK_PAGE_H]);
  const page = pdf.getPage(pdf.getPageCount() - 1);
  const { width, height } = page.getSize();
  return { page, width, height };
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

  const letterhead = await loadLetterheadTemplate();
  const margin = 48;

  let { page, width: pageWidth, height: pageHeight } =
    await addPageWithLetterhead(pdf, letterhead);
  let maxWidth = pageWidth - 2 * margin;
  const topInset = letterhead ? LETTERHEAD_TOP_RESERVE_PTS : margin;
  let y = pageHeight - topInset;

  const body = PDF_PT_BODY;
  const title = PDF_PT_TITLE;
  const sub = PDF_PT_SUBHEADING;

  const ensureSpace = async (need: number) => {
    if (y < margin + need) {
      const next = await addPageWithLetterhead(pdf, letterhead);
      page = next.page;
      pageWidth = next.width;
      pageHeight = next.height;
      maxWidth = pageWidth - 2 * margin;
      y = pageHeight - (letterhead ? LETTERHEAD_TOP_RESERVE_PTS : margin);
    }
  };

  const drawTextLines = async (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    const raw = text.trim();
    if (!raw) return;
    const advance = lineAdvancePts(size);
    const paraExtra = Math.max(4, advance * 0.35);
    const paragraphs = /\n\s*\n/.test(raw)
      ? raw
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [raw];
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const block = paragraphs[pi];
      const lines = block
        .split(/\n/)
        .flatMap((p) => wrapLine(p, f, size, maxWidth));
      for (const ln of lines) {
        await ensureSpace(advance + 4);
        page.drawText(ln, {
          x: margin,
          y,
          size,
          font: f,
          color: rgb(0.1, 0.1, 0.12),
        });
        y -= advance;
      }
      if (pi < paragraphs.length - 1) y -= paraExtra;
    }
  };

  await ensureSpace(40);
  page.drawText(sanitizePdfWinAnsi("ResumeIQ — Applicant ranking report"), {
    x: margin,
    y,
    size: title,
    font: fontBold,
    color: rgb(0.05, 0.05, 0.08),
  });
  y -= PDF_TITLE_BLOCK_PTS;

  await drawTextLines(`Generated: ${new Date().toLocaleString()}`, body);
  y -= 4;

  await drawTextLines("HR criteria summary", sub, true);
  await drawTextLines(criteriaSummary(criteria), body);
  y -= 6;

  await drawTextLines("Ranked candidates", sub, true);
  y -= 4;

  for (const c of candidates) {
    const a = c.analysis;
    const interview =
      a.recommendation === "Strong Candidate" ||
      a.recommendation === "Consider for Interview"
        ? "Interview: Yes"
        : "Interview: No";

    await drawTextLines(
      `${c.rank}. ${a.candidateName || "Unknown"} — Score ${c.rankScore.toFixed(1)} / 100 · ${interview} · ${a.recommendation}`,
      body,
      true,
    );
    await drawTextLines(`File: ${c.fileName}`, body);
    const topGood = (a.goodThings ?? []).slice(0, 2).join("; ");
    const topBad = (a.badThings ?? []).slice(0, 2).join("; ");
    if (topGood) await drawTextLines(`Good: ${topGood}`, body);
    if (topBad) await drawTextLines(`Risks: ${topBad}`, body);
    const just = a.assessment.justification;
    await drawTextLines(
      `Fit: ${a.assessment.fitScore}/10 — ${just.slice(0, 360)}${just.length > 360 ? "…" : ""}`,
      body,
    );
    y -= 6;
  }

  if (failed.length) {
    await drawTextLines("Could not process", sub, true);
    for (const f of failed) {
      await drawTextLines(`• ${f.fileName}: ${f.error ?? "Error"}`, body);
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

export async function downloadSingleResumePdf(
  criteria: HrCriteria,
  analysis: ResumeAnalysis,
): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const letterhead = await loadLetterheadTemplate();
  const margin = 48;

  let { page, width: pageWidth, height: pageHeight } =
    await addPageWithLetterhead(pdf, letterhead);
  let maxWidth = pageWidth - 2 * margin;
  const topInset = letterhead ? LETTERHEAD_TOP_RESERVE_PTS : margin;
  let y = pageHeight - topInset;

  const body = PDF_PT_BODY;
  const title = PDF_PT_TITLE;
  const sub = PDF_PT_SUBHEADING;

  const ensureSpace = async (need: number) => {
    if (y < margin + need) {
      const next = await addPageWithLetterhead(pdf, letterhead);
      page = next.page;
      pageWidth = next.width;
      pageHeight = next.height;
      maxWidth = pageWidth - 2 * margin;
      y = pageHeight - (letterhead ? LETTERHEAD_TOP_RESERVE_PTS : margin);
    }
  };

  const drawTextLines = async (text: string, size: number, bold = false) => {
    const f = bold ? fontBold : font;
    const raw = text.trim();
    if (!raw) return;
    const advance = lineAdvancePts(size);
    const paraExtra = Math.max(4, advance * 0.35);
    const paragraphs = /\n\s*\n/.test(raw)
      ? raw
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [raw];
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const block = paragraphs[pi];
      const lines = block
        .split(/\n/)
        .flatMap((p) => wrapLine(p, f, size, maxWidth));
      for (const ln of lines) {
        await ensureSpace(advance + 4);
        page.drawText(ln, {
          x: margin,
          y,
          size,
          font: f,
          color: rgb(0.1, 0.1, 0.12),
        });
        y -= advance;
      }
      if (pi < paragraphs.length - 1) y -= paraExtra;
    }
  };

  page.drawText(sanitizePdfWinAnsi("ResumeIQ — AI result"), {
    x: margin,
    y,
    size: title,
    font: fontBold,
    color: rgb(0.05, 0.05, 0.08),
  });
  y -= PDF_TITLE_BLOCK_PTS;

  await drawTextLines(`Generated: ${new Date().toLocaleString()}`, body);
  y -= 4;

  await drawTextLines("HR criteria summary", sub, true);
  await drawTextLines(criteriaSummary(criteria), body);
  y -= 6;

  await drawTextLines("Candidate", sub, true);
  await drawTextLines(`Name: ${analysis.candidateName || "Candidate"}`, body);
  const contact = [
    analysis.contactInfo.email,
    analysis.contactInfo.phone,
    analysis.contactInfo.location,
  ]
    .filter(Boolean)
    .join(" · ");
  if (contact) await drawTextLines(`Contact: ${contact}`, body);
  await drawTextLines(`Recommendation: ${analysis.recommendation}`, body, true);
  await drawTextLines(`Fit score: ${analysis.assessment.fitScore}/10`, body, true);
  y -= 6;

  await drawTextLines("Summary", sub, true);
  await drawTextLines(analysis.summary || "—", body);

  const skills = (analysis.skills ?? []).filter((s) => s.trim());
  if (skills.length) {
    y -= 4;
    await drawTextLines("Skills (top)", sub, true);
    await drawTextLines(skills.slice(0, 18).join(", "), body);
  }

  const good = (analysis.goodThings ?? []).slice(0, 6);
  const bad = (analysis.badThings ?? []).slice(0, 6);
  if (good.length || bad.length) {
    y -= 4;
    await drawTextLines("Signals", sub, true);
    if (good.length) await drawTextLines(`Good: ${good.join("; ")}`, body);
    if (bad.length) await drawTextLines(`Risks: ${bad.join("; ")}`, body);
  }

  const ratings = (analysis.criteriaRatings ?? []).slice(0, 12);
  if (ratings.length) {
    y -= 4;
    await drawTextLines("Criteria ratings (top)", sub, true);
    for (const r of ratings) {
      await drawTextLines(`${r.criterion} — ${r.rating}/5`, body, true);
      if (r.evidence?.trim()) await drawTextLines(`Evidence: ${r.evidence}`, body);
      y -= 2;
    }
  }

  y -= 4;
  await drawTextLines("Justification", sub, true);
  await drawTextLines(analysis.assessment.justification || "—", body);

  const bytes = await pdf.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resumeiq-ai-result-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Client template style: CANDIDATE NAME, PROFILE, labeled skill blocks (e.g. TECHNICAL SKILLS), PROFESSIONAL EXPERIENCE,
 * EDUCATION / CREDENTIALS / CERTIFICATES, CERTIFICATES, TRAININGS.
 * No contact fields, no AI. Includes profile/summary verbatim.
 */
export async function downloadFormattedResumePdf(
  analysis: ResumeAnalysis,
): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const letterhead = await loadLetterheadTemplate();
  const margin = 48;
  /** Space after major blocks (e.g. Profile → Skills, Skills → Experience). */
  const sectionGap = 22;
  /** Space between related sub-blocks (e.g. within experience). */
  const blockGap = 14;
  /** Space after each bullet / list item (one “sentence” block). */
  const bulletAfterGap = 7;
  /** Space under section headings before body text. */
  const headingBelowGap = 9;

  const body = PDF_PT_BODY;
  const label = PDF_PT_BODY;
  const section = PDF_PT_SUBHEADING;
  /** Slightly looser leading than default PDF body for readability. */
  const formattedLeading = 1.62;

  let { page, width: pageWidth, height: pageHeight } =
    await addPageWithLetterhead(pdf, letterhead);
  let maxWidth = pageWidth - 2 * margin;
  const topInset = letterhead ? LETTERHEAD_TOP_RESERVE_PTS : margin;
  let y = pageHeight - topInset;

  const ensureSpace = async (need: number) => {
    if (y < margin + need) {
      const next = await addPageWithLetterhead(pdf, letterhead);
      page = next.page;
      pageWidth = next.width;
      pageHeight = next.height;
      maxWidth = pageWidth - 2 * margin;
      y = pageHeight - (letterhead ? LETTERHEAD_TOP_RESERVE_PTS : margin);
    }
  };

  const drawLines = async (
    text: string,
    size: number,
    bold = false,
    indent = 0,
  ) => {
    const f = bold ? fontBold : font;
    const step = Math.max(12, size * formattedLeading);
    const paraExtra = Math.max(8, step * 0.5);
    const raw = text.trim();
    if (!raw) return;
    const innerWidth = maxWidth - indent;
    const paragraphs = /\n\s*\n/.test(raw)
      ? raw
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [raw];
    if (paragraphs.length === 0) return;
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const block = paragraphs[pi];
      const lines = block
        .split(/\n/)
        .flatMap((p) => wrapLine(p, f, size, innerWidth));
      for (const ln of lines) {
        await ensureSpace(step + 2);
        page.drawText(ln, {
          x: margin + indent,
          y,
          size,
          font: f,
          color: rgb(0.1, 0.1, 0.12),
        });
        y -= step;
      }
      if (pi < paragraphs.length - 1) await skip(paraExtra);
    }
  };

  const skip = async (pts: number) => {
    await ensureSpace(pts);
    y -= pts;
  };

  const name = (analysis.candidateName || "Candidate").trim();

  await drawLines(`CANDIDATE NAME: ${name}`, label, true);
  await skip(blockGap);

  const profile = analysis.summary?.trim();
  if (profile) {
    await drawLines(`PROFILE: ${profile}`, body);
    await skip(sectionGap);
  }

  const sections = analysis.skillsSections?.filter(
    (s) => s.title?.trim() && (s.items?.length ?? 0) > 0,
  );
  const flatSkills = (analysis.skills ?? []).filter((s) => s.trim());

  if (sections && sections.length > 0) {
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      if (i > 0) await skip(sectionGap);
      await drawLines(sec.title.trim(), section, true);
      await skip(headingBelowGap);
      for (const item of sec.items ?? []) {
        if (item.trim()) {
          await drawLines(`• ${item.trim()}`, body);
          await skip(bulletAfterGap);
        }
      }
    }
    await skip(sectionGap);
  } else if (flatSkills.length) {
    await drawLines("SKILLS:", section, true);
    await skip(headingBelowGap);
    for (const s of flatSkills) {
      await drawLines(`• ${s}`, body);
      await skip(bulletAfterGap);
    }
    await skip(sectionGap);
  }

  const jobs = analysis.experience ?? [];
  if (jobs.length) {
    await drawLines("PROFESSIONAL EXPERIENCE", section, true);
    await skip(headingBelowGap);
    for (const job of jobs) {
      const titleRaw = job.title?.trim() ?? "";
      const durationRaw = job.duration?.trim() ?? "";
      if (titleRaw && durationRaw) {
        const f = fontBold;
        const size = body;
        const step = Math.max(12, size * formattedLeading);
        const minGap = 14;
        const duration = sanitizePdfWinAnsi(durationRaw);
        const dateW = f.widthOfTextAtSize(duration, size);
        const rightX = pageWidth - margin - dateW;
        const leftMax = Math.max(36, rightX - margin - minGap);
        const titleLines = wrapLine(titleRaw, f, size, leftMax);
        const color = rgb(0.1, 0.1, 0.12);
        for (let li = 0; li < titleLines.length; li++) {
          const ln = titleLines[li];
          await ensureSpace(step + 2);
          if (ln) {
            page.drawText(ln, {
              x: margin,
              y,
              size,
              font: f,
              color,
            });
          }
          if (li === 0) {
            page.drawText(duration, {
              x: rightX,
              y,
              size,
              font: f,
              color,
            });
          }
          y -= step;
        }
      } else if (titleRaw) {
        await drawLines(titleRaw, body, true);
      } else if (durationRaw) {
        await drawLines(durationRaw, body, true);
      }
      if (job.company?.trim()) await drawLines(job.company.trim(), body);
      if (job.location?.trim()) await drawLines(job.location.trim(), body);
      const responsibilities = effectiveJobResponsibilities(job);
      if (responsibilities.length) {
        await skip(6);
        await drawLines("Job Responsibilities:", label, true);
        await skip(headingBelowGap - 2);
        for (const h of responsibilities) {
          await drawLines(`● ${h}`, body);
          await skip(bulletAfterGap);
        }
      }
      if (job.specialistLead?.trim()) {
        await skip(6);
        await drawLines("Specialist / Digital Services Lead:", label, true);
        await skip(headingBelowGap - 2);
        await drawLines(job.specialistLead.trim(), body);
      }
      const projects = (job.projectsInclude ?? [])
        .map((p) => p.trim())
        .filter(Boolean);
      if (projects.length) {
        await skip(6);
        await drawLines("Projects include:", label, true);
        await skip(headingBelowGap - 2);
        for (const p of projects) {
          await drawLines(`● ${p}`, body);
          await skip(bulletAfterGap);
        }
      }
      await skip(blockGap);
    }
    await skip(sectionGap - blockGap);
  }

  await drawLines(
    "EDUCATION / CREDENTIALS / CERTIFICATES",
    section,
    true,
  );
  await skip(headingBelowGap);
  const edu = analysis.education ?? [];
  for (const e of edu) {
    if (e.degree?.trim()) await drawLines(e.degree.trim(), body, true);
    const schoolLine = [e.school, e.year].filter(Boolean).join(" ");
    if (schoolLine.trim()) await drawLines(schoolLine.trim(), body);
    await skip(blockGap + 2);
  }
  if (!edu.length) await drawLines("—", body);

  const certs = safeCertificateArray(analysis.certificates);
  if (certs.length) {
    await skip(sectionGap);
    await drawLines("CERTIFICATES", section, true);
    await skip(headingBelowGap);
    const drawCert = async (c: CertificateEntry) => {
      if (!c.name?.trim()) return;
      await drawLines(c.name.trim(), body, true);
      await skip(4);
      if (c.datedItems?.length) {
        for (const g of c.datedItems) {
          if (g.period?.trim()) {
            await drawLines(g.period.trim(), body, false, 10);
            await skip(4);
          }
          for (const line of g.items ?? []) {
            if (!line.trim()) continue;
            await drawLines(`● ${line.trim()}`, body, false, 22);
            await skip(bulletAfterGap);
          }
          await skip(4);
        }
      }
      await skip(blockGap - 4);
    };
    for (const c of certs) await drawCert(c);
  }

  const trainings = (analysis.trainings ?? []).filter((s) => s.trim());
  if (trainings.length) {
    await skip(sectionGap);
    await drawLines("TRAININGS", section, true);
    await skip(headingBelowGap);
    for (const t of trainings) {
      await drawLines(`• ${t}`, body);
      await skip(bulletAfterGap);
    }
  }

  const bytes = await pdf.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `formatted-resume-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
