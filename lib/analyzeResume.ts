import OpenAI from "openai";
import { resolveAnalysisModel } from "@/lib/analyzeModels";
import { resolveCandidateName } from "@/lib/candidateNameResolution";
import type { HrCriteria } from "@/lib/hrCriteria";
import { EMPTY_HR_CRITERIA } from "@/lib/hrCriteria";

export type Recommendation =
  | "Strong Candidate"
  | "Consider for Interview"
  | "Not a Match";

export type CriteriaRatingValue = 1 | 2 | 3 | 4 | 5;

export interface CriteriaRating {
  criterion: string;
  rating: CriteriaRatingValue;
  evidence: string;
}

/** Labeled skill blocks (e.g. FUNCTIONAL SKILLS vs TECHNICAL SKILLS) preserved verbatim from the resume. */
export interface SkillsSection {
  title: string;
  items: string[];
}

/** One date/month heading on the resume with exam or module lines beneath it (e.g. SAP certs). */
export interface CertificateDatedGroup {
  period: string;
  items: string[];
}

/** Vendor/professional certifications; not academic degrees or school programs. */
export interface CertificateEntry {
  name: string;
  datedItems?: CertificateDatedGroup[];
}

/** Subsection under one role: optional title (empty = bullets before first titled group) + duty lines. */
export interface JobResponsibilityBlock {
  /** Verbatim subsection heading, or "" for lead-in bullets before the first titled group */
  subtitle: string;
  items: string[];
}

/** Top-level PROJECTS section entry (not tied to one employer). */
export interface StandaloneProjectEntry {
  title: string;
  duration?: string;
  companyOrContext?: string;
  bullets: string[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  duration: string;
  /** Office or site line when printed under the role */
  location?: string;
  /** Bullets under “Job Responsibilities” or general role duties when not split further */
  jobResponsibilities: string[];
  /**
   * When the resume groups duties under inline subsection titles (e.g. Health, Safety, and Environment),
   * preserve structure here. If present, jobResponsibilities is normalized to the concatenation of all items.
   */
  jobResponsibilityBlocks?: JobResponsibilityBlock[];
  /** Verbatim block under headings like Specialist / Digital Services Lead */
  specialistLead?: string;
  /** Bullets under “Projects include” (or similar) */
  projectsInclude?: string[];
  /**
   * Legacy analyses only — server output uses jobResponsibilities.
   * Kept so older saved JSON still renders.
   */
  highlights?: string[];
}

export interface ResumeAnalysis {
  candidateName: string;
  contactInfo: {
    email: string;
    phone: string;
    location: string;
  };
  /** Short professional narrative from the resume (Profile / Summary / Objective prose only—not skill lists). */
  summary: string;
  skills: string[];
  /** When the resume splits skills into sections, preserve each block; optional. */
  skillsSections?: SkillsSection[];
  /** Major PROJECTS / Key Projects section outside employment; not per-job projectsInclude. */
  standaloneProjects?: StandaloneProjectEntry[];
  experience: ExperienceEntry[];
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  /** Vendor/professional certifications (SAP, AWS, etc.), not degrees. */
  certificates: CertificateEntry[];
  /** Formal trainings listed on the resume (use [] if none). */
  trainings: string[];
  /** Per-criterion ratings vs HR criteria (and inferred checks like gaps/tenure when HR asked). */
  criteriaRatings: CriteriaRating[];
  /** Positive signals vs role and HR criteria. */
  goodThings: string[];
  /** Risks, gaps, or mismatches vs HR criteria. */
  badThings: string[];
  assessment: {
    strengths: string;
    concerns: string;
    fitScore: number;
    justification: string;
  };
  recommendation: Recommendation;
}

const RECOMMENDATIONS: Recommendation[] = [
  "Strong Candidate",
  "Consider for Interview",
  "Not a Match",
];

/** Cap extracted resume text before sending to the model (token safety). */
const MAX_RESUME_CHARS = 50_000;

function buildExtractionSystemPrompt(): string {
  return `You are a precise document transcriber for resumes. Your ONLY job is to copy structured data OUT of the resume text into JSON. You are NOT a writer—do not paraphrase, summarize, translate, "improve", normalize names, fix spelling, or infer facts that are not written in the resume.

Respond with ONLY a valid JSON object (no markdown, no prose outside JSON).

The JSON must match this exact shape and key names:
{
  "candidateName": "string",
  "contactInfo": {
    "email": "string",
    "phone": "string",
    "location": "string"
  },
  "summary": "string",
  "skills": ["string"],
  "skillsSections": [
    {
      "title": "string (section heading as printed, e.g. FUNCTIONAL SKILLS)",
      "items": ["string"]
    }
  ],
  "standaloneProjects": [
    {
      "title": "string (project name or heading line as printed)",
      "duration": "string (date range if printed; else \"\")",
      "companyOrContext": "string (org or context line if printed; else \"\")",
      "bullets": ["string"]
    }
  ],
  "experience": [
    {
      "title": "string (job title / role line)",
      "company": "string",
      "duration": "string (date range exactly as printed)",
      "location": "string (city/region line if printed; else \"\")",
      "jobResponsibilities": ["string"],
      "jobResponsibilityBlocks": [
        {
          "subtitle": "string (verbatim subsection title, or empty string \"\" for bullets that appear before the first titled subsection)",
          "items": ["string (duty bullets under that subsection only)"]
        }
      ],
      "specialistLead": "string (verbatim under Specialist / Digital Services Lead or similar; else \"\")",
      "projectsInclude": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "school": "string",
      "year": "string"
    }
  ],
  "certificates": [
    {
      "name": "string (main certification title as printed)",
      "datedItems": [
        {
          "period": "string (month/year heading as printed, e.g. August 2024)",
          "items": ["string (exam/module lines under that period)"]
        }
      ]
    }
  ],
  "trainings": ["string"]
}

Transcription rules (critical):
- Ignore email subjects and watermarks. Use ONLY the resume text provided in the user message.
- candidateName: Copy the person's full name EXACTLY as it appears in the resume's primary heading (usually the largest name at the top). Include every printed given name, middle name, maternal/paternal surname, and particle—never shorten to only first and last when the resume shows more (e.g. if the heading is "SHERMAINE NARIO TOREJA", output all three name parts, not "Shermaine Toreja"). Preserve character order, capitalization, spacing, and punctuation exactly as printed (e.g. if the resume shows "TOREJAS HERMAINE", output that exact string). Do NOT reorder name parts, do NOT switch to Western given-name-first order.
- candidateName must be a person's name (often 2–6 words when middle names or multiple surnames appear). NEVER put a job title, certification headline, or role descriptor here (e.g. lines like "SAP Certified Associate", "Implementation Consultant", "Business Analyst" belong in experience or certificates, not candidateName).
- If the name is not present in the extracted text (common when the header is a graphic/image in the PDF so only body text was extracted), use "" for candidateName and do NOT fill it with the first headline line if that line is clearly a role or certification.
- contactInfo: Copy emails, phone numbers, and address/location lines verbatim into the three fields. Use "" if a field is missing.
- summary: Copy ONLY opening narrative prose: Professional Summary, Profile, About, or Objective sections when they are written as sentences/paragraphs about the candidate (goals, background, years of experience). Join multiple paragraphs with a single newline. Use "" if there is no such prose block.
- summary must NOT contain: bulleted or checkmarked lists of tools, technologies, or competencies; lines that belong under headings such as SKILLS, TECHNICAL SKILLS, FUNCTIONAL SKILLS, CORE COMPETENCIES, EXPERTISE, KEY SKILLS, or similar—even if another part of the resume mislabels a skill list. Those lines belong ONLY in skills/skillsSections.
- skills: Include EVERY line from ALL skills-related areas in one flat list in document order (tools, technologies, competency bullets, checkmarks, dashes). Do not merge, summarize, or drop lines.
- skillsSections: When the resume has one or more labeled skill blocks, create one object per printed heading with that heading copied EXACTLY as it appears (e.g. SKILLS, Soft Skills, TECHNICAL SKILLS, FUNCTIONAL SKILLS). Put every bullet/line under that heading in items. Do not invent headings, do not rename TECHNICAL SKILLS to something else, and do not put skill bullets under summary. Use [] only when the resume has a single undivided list with no subsection titles; then use the flat skills array only. If skillsSections is non-empty, skills must list the same lines in order (concatenation of all sections).
- experience: One object per employment, internship, or work-history block (as labeled on the resume). Copy title, company, and duration EXACTLY as written. Put title + duration on one conceptual line in the data (title and duration are separate fields; the UI prints them together). Put company on the next line (company field). Copy location into location when a place line appears for that role.
- experience / jobResponsibilityBlocks: When duties under one role are grouped under inline subsection TITLES (e.g. bold lines like "Business Solution", "Health, Safety, and Environment", or a dash-prefixed line that is clearly a category label followed by real task bullets—not a task itself), use jobResponsibilityBlocks to preserve structure. Each object: subtitle = the heading copied verbatim (strip a leading bullet/dash/hyphen from the heading text if the resume used one on the title line only); items = only the task bullets under that heading. Use subtitle "" for the first block when bullets appear before any titled subsection. When the resume has NO such titled subgroups, omit jobResponsibilityBlocks entirely and use only jobResponsibilities.
- experience / jobResponsibilities: When jobResponsibilityBlocks is omitted, copy EVERY bullet or sentence under "Job Responsibilities", role duties, or generic responsibility bullets for that employer here. When jobResponsibilityBlocks is used, you may omit jobResponsibilities or use [] (the system will flatten items from blocks). If you include both, blocks take precedence for structure; still list the same duty lines in blocks only, not duplicated as a flat list.
- experience / specialistLead: Copy the full text under headings like "Specialist / Digital Services Lead" (or the same wording as on the resume). Use "" when that subsection is absent or empty.
- experience / projectsInclude: Copy bullets/lines under "Projects include" (or the same wording on the resume) when that subsection appears INSIDE a single job entry. Use [] when absent or empty. Do not put the standalone resume section PROJECTS here—that belongs in standaloneProjects.
- standaloneProjects: When the resume has a major section such as PROJECTS, KEY PROJECTS, or SELECTED PROJECTS that is NOT nested under one employer (its own heading and optional date range, separate from work history), transcribe each project as one object: title, duration, companyOrContext, and bullets as printed. Use [] when there is no such section. This is NOT the same as experience[].projectsInclude (in-job project lists).
- education: Academic degrees and diploma programs from schools/universities only, plus government-issued professional registrations/licenses shown as eligibility (e.g. Registered Civil Engineer with issuing body and date). Copy degree name, school, and year/graduation text verbatim.
- education (exclusions): NEVER put vendor or product certifications here (e.g. SAP Certified, AWS Certified, Microsoft Certified, PMP, Scrum Master certificates, "SAP CERTIFIED ASSOCIATE", course completion badges) even if the resume groups them visually under "Education and Eligibility" or similar — those belong ONLY in certificates.
- certificates: Vendor/professional/product certifications and credential programs (SAP, cloud certs, etc.). For each distinct certification family, use one object with name = the main title line. If the resume lists exams or modules under month/year subheadings, use datedItems: one object per printed period with items = the lines under that period (preserve wording). If a cert is a single line with no sub-structure, use { "name": "..." } and omit datedItems or use []. Use [] when there are no such certifications.
- trainings: Copy each training program line verbatim when the resume has a Trainings section; otherwise [].
- Use "" or [] when information is missing; do not omit required keys.`;
}

function buildScreeningSystemPrompt(): string {
  return `You are an expert HR recruiter. You receive (1) HR screening criteria as JSON, (2) VERBATIM_RESUME_FACTS JSON that was transcribed from the resume (treat identity and quoted facts as ground truth), and (3) the full resume text for additional context.

Your job is ONLY to produce screening output: criteria ratings, strengths/concerns, fit score, recommendation, and short bullets. Do NOT re-transcribe the resume. When you refer to the candidate, use the exact candidateName from VERBATIM_RESUME_FACTS.

Respond with ONLY a valid JSON object (no markdown, no prose outside JSON).

The JSON must match this exact shape and key names:
{
  "criteriaRatings": [
    {
      "criterion": "string (e.g. Must-have: React)",
      "rating": 1,
      "evidence": "string (short quote or paraphrase tied to resume text)"
    }
  ],
  "goodThings": ["string"],
  "badThings": ["string"],
  "assessment": {
    "strengths": "string",
    "concerns": "string",
    "fitScore": 5,
    "justification": "string"
  },
  "recommendation": "Strong Candidate" | "Consider for Interview" | "Not a Match"
}

Rules:
- criteriaRatings: For EACH active HR criterion (non-empty lists and numeric thresholds the HR set), include one object with a clear "criterion" label and rating 1-5. If HR provided no specific criteria, include 5-8 criteriaRatings for general dimensions (skills fit, experience depth, impact/achievements, communication/leadership signals, education, stability/gaps, company count vs expectation).
- rating must be an integer 1-5 only.
- goodThings / badThings: concise bullets tied to HR criteria where possible.
- fitScore must be an integer from 1 to 10.
- recommendation must be exactly one of: "Strong Candidate", "Consider for Interview", "Not a Match". Align recommendation with HR must-haves and dealbreakers when stated.
- If age is required by HR but not present on resume, add a criteriaRating noting "Age not stated" with low confidence and explain in evidence.
- Estimate total years of relevant experience and employment gaps only when reasonable from dates; state uncertainty in evidence when dates are ambiguous.`;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

function isRating(v: unknown): v is CriteriaRatingValue {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= 1 &&
    v <= 5
  );
}

export type ResumeBodyFacts = Pick<
  ResumeAnalysis,
  | "candidateName"
  | "contactInfo"
  | "summary"
  | "skills"
  | "skillsSections"
  | "standaloneProjects"
  | "experience"
  | "education"
  | "certificates"
  | "trainings"
>;

export type ResumeScreening = Pick<
  ResumeAnalysis,
  | "criteriaRatings"
  | "goodThings"
  | "badThings"
  | "assessment"
  | "recommendation"
>;

function parseCertificateArray(arr: unknown): CertificateEntry[] {
  if (!Array.isArray(arr)) {
    throw new Error("Missing or invalid certificates");
  }
  const out: CertificateEntry[] = [];
  for (let i = 0; i < arr.length; i++) {
    const raw = arr[i];
    if (typeof raw === "string") {
      const name = raw.trim();
      if (name) out.push({ name });
      continue;
    }
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`Invalid certificates[${i}]`);
    }
    const o = raw as Record<string, unknown>;
    if (!isString(o.name)) {
      throw new Error(`Invalid certificates[${i}].name`);
    }
    const name = o.name.trim();
    if (!name) continue;

    let datedItems: CertificateDatedGroup[] | undefined;
    const datedRaw = o.datedItems;
    if (datedRaw !== undefined && datedRaw !== null) {
      if (!Array.isArray(datedRaw)) {
        throw new Error(`Invalid certificates[${i}].datedItems`);
      }
      const groups: CertificateDatedGroup[] = [];
      for (let j = 0; j < datedRaw.length; j++) {
        const g = datedRaw[j];
        if (typeof g !== "object" || g === null) {
          throw new Error(`Invalid certificates[${i}].datedItems[${j}]`);
        }
        const gr = g as Record<string, unknown>;
        if (!isString(gr.period) || !isStringArray(gr.items)) {
          throw new Error(
            `Invalid certificates[${i}].datedItems[${j}] fields`,
          );
        }
        const items = gr.items.map((s) => s.trim()).filter(Boolean);
        const period = gr.period.trim();
        if (period || items.length > 0) {
          groups.push({ period, items });
        }
      }
      if (groups.length > 0) datedItems = groups;
    }

    out.push(datedItems?.length ? { name, datedItems } : { name });
  }
  return out;
}

/**
 * Best-effort parse for client-side PDF/UI when analysis JSON is older or partially shaped.
 */
export function safeCertificateArray(arr: unknown): CertificateEntry[] {
  try {
    return parseCertificateArray(arr);
  } catch {
    return [];
  }
}

/** Responsibility bullets: current field or legacy highlights from saved analyses. */
export function effectiveJobResponsibilities(job: ExperienceEntry): string[] {
  const from = job.jobResponsibilities?.filter((s) => s.trim()) ?? [];
  if (from.length > 0) return from;
  return job.highlights?.filter((s) => s.trim()) ?? [];
}

export type JobResponsibilityRenderModel =
  | { mode: "flat"; items: string[] }
  | { mode: "blocks"; blocks: JobResponsibilityBlock[] };

/** Prefer structured blocks when present; otherwise flat bullets for PDF/UI. */
export function getJobResponsibilityRenderModel(
  job: ExperienceEntry,
): JobResponsibilityRenderModel {
  const blocks = job.jobResponsibilityBlocks?.filter(
    (b) => (b.items?.filter((s) => s.trim()).length ?? 0) > 0,
  );
  if (blocks && blocks.length > 0) {
    return { mode: "blocks", blocks };
  }
  return { mode: "flat", items: effectiveJobResponsibilities(job) };
}

function parseJobResponsibilityBlocks(
  v: unknown,
  expIndex: number,
): JobResponsibilityBlock[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) {
    throw new Error(`Invalid experience[${expIndex}].jobResponsibilityBlocks`);
  }
  if (v.length === 0) return undefined;
  const out: JobResponsibilityBlock[] = [];
  for (let j = 0; j < v.length; j++) {
    const item = v[j];
    if (typeof item !== "object" || item === null) {
      throw new Error(
        `Invalid experience[${expIndex}].jobResponsibilityBlocks[${j}]`,
      );
    }
    const b = item as Record<string, unknown>;
    const subtitle = isString(b.subtitle) ? b.subtitle.trim() : "";
    if (!isStringArray(b.items)) {
      throw new Error(
        `Invalid experience[${expIndex}].jobResponsibilityBlocks[${j}].items`,
      );
    }
    const items = b.items.map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) continue;
    out.push({ subtitle, items });
  }
  return out.length > 0 ? out : undefined;
}

function parseStandaloneProjects(v: unknown): StandaloneProjectEntry[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) {
    throw new Error("Missing or invalid standaloneProjects");
  }
  if (v.length === 0) return undefined;
  const out: StandaloneProjectEntry[] = [];
  for (let i = 0; i < v.length; i++) {
    const raw = v[i];
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`Invalid standaloneProjects[${i}]`);
    }
    const p = raw as Record<string, unknown>;
    if (!isString(p.title) || !p.title.trim()) {
      throw new Error(`Invalid standaloneProjects[${i}].title`);
    }
    const duration =
      isString(p.duration) && p.duration.trim() ? p.duration.trim() : undefined;
    const companyOrContext =
      isString(p.companyOrContext) && p.companyOrContext.trim()
        ? p.companyOrContext.trim()
        : undefined;
    const bullets = isStringArray(p.bullets)
      ? p.bullets.map((s) => s.trim()).filter(Boolean)
      : [];
    out.push({
      title: p.title.trim(),
      duration,
      companyOrContext,
      bullets,
    });
  }
  return out.length > 0 ? out : undefined;
}

function validateSkillsSections(v: unknown): SkillsSection[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) {
    throw new Error("Missing or invalid skillsSections");
  }
  if (v.length === 0) return undefined;
  return v.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid skillsSections[${i}]`);
    }
    const e = item as Record<string, unknown>;
    if (!isString(e.title) || !isStringArray(e.items)) {
      throw new Error(`Invalid skillsSections[${i}] fields`);
    }
    return { title: e.title, items: e.items };
  });
}

function validateResumeBody(data: unknown): ResumeBodyFacts {
  if (typeof data !== "object" || data === null) {
    throw new Error("Resume body must be a JSON object");
  }
  const o = data as Record<string, unknown>;

  if (!isString(o.candidateName)) {
    throw new Error("Missing or invalid candidateName");
  }

  const ci = o.contactInfo;
  if (typeof ci !== "object" || ci === null) {
    throw new Error("Missing or invalid contactInfo");
  }
  const c = ci as Record<string, unknown>;
  if (!isString(c.email) || !isString(c.phone) || !isString(c.location)) {
    throw new Error("Missing or invalid contactInfo fields");
  }

  if (!isString(o.summary)) {
    throw new Error("Missing or invalid summary");
  }

  if (!isStringArray(o.skills)) {
    throw new Error("Missing or invalid skills");
  }

  const skillsSections = validateSkillsSections(o.skillsSections);
  let skills = [...o.skills];
  if (skillsSections && skillsSections.length > 0) {
    skills = skillsSections.flatMap((s) => s.items);
  }

  if (!Array.isArray(o.experience)) {
    throw new Error("Missing or invalid experience");
  }
  const experience = o.experience.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid experience[${i}]`);
    }
    const e = item as Record<string, unknown>;
    if (!isString(e.title) || !isString(e.company) || !isString(e.duration)) {
      throw new Error(`Invalid experience[${i}] fields`);
    }
    const jobResponsibilityBlocks = parseJobResponsibilityBlocks(
      e.jobResponsibilityBlocks,
      i,
    );
    let jobResponsibilities: string[] = [];
    if (jobResponsibilityBlocks && jobResponsibilityBlocks.length > 0) {
      jobResponsibilities = jobResponsibilityBlocks.flatMap((b) => b.items);
    } else if (isStringArray(e.jobResponsibilities)) {
      jobResponsibilities = e.jobResponsibilities
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (isStringArray(e.highlights)) {
      jobResponsibilities = e.highlights.map((s) => s.trim()).filter(Boolean);
    }
    const projectsInclude = isStringArray(e.projectsInclude)
      ? e.projectsInclude.map((s) => s.trim()).filter(Boolean)
      : [];
    const location =
      isString(e.location) && e.location.trim() ? e.location.trim() : undefined;
    const specialistLead =
      isString(e.specialistLead) && e.specialistLead.trim()
        ? e.specialistLead.trim()
        : undefined;
    const entry: ExperienceEntry = {
      title: e.title,
      company: e.company,
      duration: e.duration,
      location,
      jobResponsibilities,
      specialistLead,
      projectsInclude,
    };
    if (jobResponsibilityBlocks?.length) {
      entry.jobResponsibilityBlocks = jobResponsibilityBlocks;
    }
    return entry;
  });

  if (!Array.isArray(o.education)) {
    throw new Error("Missing or invalid education");
  }
  const education = o.education.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid education[${i}]`);
    }
    const e = item as Record<string, unknown>;
    if (!isString(e.degree) || !isString(e.school) || !isString(e.year)) {
      throw new Error(`Invalid education[${i}] fields`);
    }
    return { degree: e.degree, school: e.school, year: e.year };
  });

  const certificates = parseCertificateArray(o.certificates ?? []);
  if (!isStringArray(o.trainings)) {
    throw new Error("Missing or invalid trainings");
  }

  const standaloneProjects = parseStandaloneProjects(o.standaloneProjects);

  return {
    candidateName: o.candidateName,
    contactInfo: {
      email: c.email,
      phone: c.phone,
      location: c.location,
    },
    summary: o.summary,
    skills,
    skillsSections,
    standaloneProjects,
    experience,
    education,
    certificates,
    trainings: o.trainings,
  };
}

function validateScreening(data: unknown): ResumeScreening {
  if (typeof data !== "object" || data === null) {
    throw new Error("Screening must be a JSON object");
  }
  const o = data as Record<string, unknown>;

  if (!Array.isArray(o.criteriaRatings)) {
    throw new Error("Missing or invalid criteriaRatings");
  }
  const criteriaRatings = o.criteriaRatings.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid criteriaRatings[${i}]`);
    }
    const r = item as Record<string, unknown>;
    if (!isString(r.criterion) || !isString(r.evidence) || !isRating(r.rating)) {
      throw new Error(`Invalid criteriaRatings[${i}] fields`);
    }
    return {
      criterion: r.criterion,
      rating: r.rating as CriteriaRatingValue,
      evidence: r.evidence,
    };
  });

  if (!isStringArray(o.goodThings)) {
    throw new Error("Missing or invalid goodThings");
  }
  if (!isStringArray(o.badThings)) {
    throw new Error("Missing or invalid badThings");
  }

  const a = o.assessment;
  if (typeof a !== "object" || a === null) {
    throw new Error("Missing or invalid assessment");
  }
  const as = a as Record<string, unknown>;
  if (
    !isString(as.strengths) ||
    !isString(as.concerns) ||
    !isNumber(as.fitScore) ||
    !isString(as.justification)
  ) {
    throw new Error("Missing or invalid assessment fields");
  }
  if (as.fitScore < 1 || as.fitScore > 10 || !Number.isInteger(as.fitScore)) {
    throw new Error("fitScore must be an integer from 1 to 10");
  }

  if (
    !isString(o.recommendation) ||
    !RECOMMENDATIONS.includes(o.recommendation as Recommendation)
  ) {
    throw new Error("Invalid recommendation value");
  }

  return {
    criteriaRatings,
    goodThings: o.goodThings,
    badThings: o.badThings,
    assessment: {
      strengths: as.strengths,
      concerns: as.concerns,
      fitScore: as.fitScore,
      justification: as.justification,
    },
    recommendation: o.recommendation as Recommendation,
  };
}

function mergeAnalysis(body: ResumeBodyFacts, screening: ResumeScreening): ResumeAnalysis {
  return {
    ...body,
    ...screening,
  };
}

export type AnalyzeResumeOptions = {
  /** Original upload file name; used to recover the real name when the PDF header is image-only. */
  fileName?: string;
  /** Chat model for extraction + screening; must match an id in `lib/analyzeModels.ts` allowlist. */
  model?: string;
};

export async function analyzeResume(
  resumeText: string,
  criteria: HrCriteria = EMPTY_HR_CRITERIA,
  options?: AnalyzeResumeOptions,
): Promise<ResumeAnalysis> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey: key });
  const model = resolveAnalysisModel(options?.model);
  const text =
    resumeText.length > MAX_RESUME_CHARS
      ? resumeText.slice(0, MAX_RESUME_CHARS)
      : resumeText;

  const criteriaJson = JSON.stringify(criteria);

  const fileHint = options?.fileName
    ? `\n\nContext: the file was uploaded as "${options.fileName}". If no person name appears in the text below (e.g. header was image-only), use "" for candidateName rather than guessing from a job title or certification line.\n`
    : "";

  const extraction = await openai.chat.completions.create({
    model,
    max_tokens: 8000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildExtractionSystemPrompt() },
      {
        role: "user",
        content: `Transcribe the resume below into the JSON schema. Remember: copy wording exactly.${fileHint}\n---\n\n${text}\n\n---`,
      },
    ],
  });

  const extractionContent = extraction.choices[0]?.message?.content;
  if (!extractionContent) {
    throw new Error("Empty response from model (extraction)");
  }

  let extractionParsed: unknown;
  try {
    extractionParsed = JSON.parse(extractionContent);
  } catch {
    throw new Error("Model returned invalid JSON (extraction)");
  }

  const body = validateResumeBody(extractionParsed);

  const resolvedName = resolveCandidateName(
    body.candidateName,
    options?.fileName,
    text,
  );
  const bodyWithResolvedName: ResumeBodyFacts = {
    ...body,
    candidateName: resolvedName,
  };

  const verbatimFactsJson = JSON.stringify(bodyWithResolvedName);

  const screening = await openai.chat.completions.create({
    model,
    max_tokens: 3500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildScreeningSystemPrompt() },
      {
        role: "user",
        content: `HR screening criteria (JSON):\n${criteriaJson}\n\nVERBATIM_RESUME_FACTS (ground truth for name, contact, and structured resume content):\n${verbatimFactsJson}\n\nFull resume text (same as transcription source):\n\n${text}`,
      },
    ],
  });

  const screeningContent = screening.choices[0]?.message?.content;
  if (!screeningContent) {
    throw new Error("Empty response from model (screening)");
  }

  let screeningParsed: unknown;
  try {
    screeningParsed = JSON.parse(screeningContent);
  } catch {
    throw new Error("Model returned invalid JSON (screening)");
  }

  const screeningResult = validateScreening(screeningParsed);
  return mergeAnalysis(bodyWithResolvedName, screeningResult);
}
