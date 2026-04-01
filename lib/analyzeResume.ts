import OpenAI from "openai";
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

export interface ResumeAnalysis {
  candidateName: string;
  contactInfo: {
    email: string;
    phone: string;
    location: string;
  };
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    highlights: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  /** Professional certifications from the resume (use [] if none). */
  certificates: string[];
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

function buildSystemPrompt(): string {
  return `You are an expert HR recruiter. Analyze the resume text using the HR screening criteria provided in the user message (JSON). Respond with ONLY a valid JSON object (no markdown, no prose outside JSON).

The JSON must match this exact shape and key names:
{
  "candidateName": "string",
  "contactInfo": {
    "email": "string",
    "phone": "string",
    "location": "string"
  },
  "summary": "string (2-3 sentences)",
  "skills": ["string"],
  "experience": [
    {
      "title": "string",
      "company": "string",
      "duration": "string",
      "highlights": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "school": "string",
      "year": "string"
    }
  ],
  "certificates": ["string"],
  "trainings": ["string"],
  "criteriaRatings": [
    {
      "criterion": "string (e.g. Must-have: React)",
      "rating": 1,
      "evidence": "string (short quote or paraphrase from resume)"
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
- Use empty string "" or empty arrays when information is missing; do not omit required keys.
- criteriaRatings: For EACH active HR criterion (non-empty lists and numeric thresholds the HR set), include one object with a clear "criterion" label and rating 1-5. If HR provided no specific criteria, include 5-8 criteriaRatings for general dimensions (skills fit, experience depth, impact/achievements, communication/leadership signals, education, stability/gaps, company count vs expectation).
- rating must be an integer 1-5 only.
- goodThings / badThings: concise bullets tied to HR criteria where possible.
- certificates: license/credential lines; trainings: dated training rows when listed.
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

function validateResumeAnalysis(data: unknown): ResumeAnalysis {
  if (typeof data !== "object" || data === null) {
    throw new Error("Analysis must be a JSON object");
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

  if (!Array.isArray(o.experience)) {
    throw new Error("Missing or invalid experience");
  }
  const experience = o.experience.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Invalid experience[${i}]`);
    }
    const e = item as Record<string, unknown>;
    if (
      !isString(e.title) ||
      !isString(e.company) ||
      !isString(e.duration) ||
      !isStringArray(e.highlights)
    ) {
      throw new Error(`Invalid experience[${i}] fields`);
    }
    return {
      title: e.title,
      company: e.company,
      duration: e.duration,
      highlights: e.highlights,
    };
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

  if (!isStringArray(o.certificates)) {
    throw new Error("Missing or invalid certificates");
  }
  if (!isStringArray(o.trainings)) {
    throw new Error("Missing or invalid trainings");
  }

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
    candidateName: o.candidateName,
    contactInfo: {
      email: c.email,
      phone: c.phone,
      location: c.location,
    },
    summary: o.summary,
    skills: o.skills,
    experience,
    education,
    certificates: o.certificates,
    trainings: o.trainings,
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

export async function analyzeResume(
  resumeText: string,
  criteria: HrCriteria = EMPTY_HR_CRITERIA,
): Promise<ResumeAnalysis> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey: key });
  const text =
    resumeText.length > MAX_RESUME_CHARS
      ? resumeText.slice(0, MAX_RESUME_CHARS)
      : resumeText;

  const criteriaJson = JSON.stringify(criteria);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 3500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: `HR screening criteria (JSON). Use these fields to score criteriaRatings and decide recommendation:\n${criteriaJson}\n\nResume text:\n\n${text}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from model");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Model returned invalid JSON");
  }

  return validateResumeAnalysis(parsed);
}
