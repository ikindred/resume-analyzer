import OpenAI from "openai";

export type Recommendation =
  | "Strong Candidate"
  | "Consider for Interview"
  | "Not a Match";

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

const SYSTEM_PROMPT = `You are an expert HR recruiter. Analyze the resume text and respond with ONLY a valid JSON object (no markdown, no prose outside JSON).

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
  "assessment": {
    "strengths": "string",
    "concerns": "string",
    "fitScore": number (1-10),
    "justification": "string"
  },
  "recommendation": "Strong Candidate" | "Consider for Interview" | "Not a Match"
}

Rules:
- Use empty string "" or empty arrays when information is missing; do not omit required keys.
- fitScore must be an integer from 1 to 10.
- recommendation must be exactly one of: "Strong Candidate", "Consider for Interview", "Not a Match".`;

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
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

  if (!isString(o.recommendation) || !RECOMMENDATIONS.includes(o.recommendation as Recommendation)) {
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
    assessment: {
      strengths: as.strengths,
      concerns: as.concerns,
      fitScore: as.fitScore,
      justification: as.justification,
    },
    recommendation: o.recommendation as Recommendation,
  };
}

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey: key });
  const text =
    resumeText.length > MAX_RESUME_CHARS
      ? resumeText.slice(0, MAX_RESUME_CHARS)
      : resumeText;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Resume text:\n\n${text}`,
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
