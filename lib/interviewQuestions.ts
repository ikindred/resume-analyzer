import OpenAI from "openai";
import type { HrCriteria } from "@/lib/hrCriteria";
import { EMPTY_HR_CRITERIA } from "@/lib/hrCriteria";
import type { ResumeAnalysis } from "@/lib/analyzeResume";

export type InterviewQuestion = {
  topic: string;
  question: string;
  why: string;
};

export type InterviewQuestionsResponse = {
  questions: InterviewQuestion[];
};

const MAX_JSON_CHARS = 40_000;

function buildSystemPrompt(): string {
  return `You are an expert recruiter and hiring manager. Generate interview questions tailored to the candidate and the HR screening criteria.\n\nReturn ONLY valid JSON.\n\nThe JSON must match this exact shape:\n{\n  \"questions\": [\n    {\n      \"topic\": \"string (e.g. React, System design, Ownership)\",\n      \"question\": \"string\",\n      \"why\": \"string (what this validates, tied to resume evidence or missing evidence)\"\n    }\n  ]\n}\n\nRules:\n- Create 8-12 questions.\n- Prefer questions that validate must-have skills and clarify risks/gaps.\n- Include at least 2 questions that probe impact/ownership with concrete examples.\n- Avoid discriminatory or sensitive topics (age, family status, etc.).\n- Keep questions concise and actionable.`;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function validateResponse(data: unknown): InterviewQuestionsResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("Response must be a JSON object");
  }
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.questions)) {
    throw new Error("Missing questions array");
  }
  const questions = o.questions
    .filter((q) => typeof q === "object" && q !== null)
    .map((q) => q as Record<string, unknown>)
    .map((q) => {
      if (!isString(q.topic) || !isString(q.question) || !isString(q.why)) {
        throw new Error("Invalid question fields");
      }
      return { topic: q.topic, question: q.question, why: q.why };
    });

  return { questions };
}

export async function generateInterviewQuestions(
  analysis: ResumeAnalysis,
  criteria: HrCriteria = EMPTY_HR_CRITERIA,
): Promise<InterviewQuestionsResponse> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey: key });
  const payload = JSON.stringify({ analysis, criteria });
  const input = payload.length > MAX_JSON_CHARS ? payload.slice(0, MAX_JSON_CHARS) : payload;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: `Candidate + criteria (JSON):\n${input}` },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from model");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Model returned invalid JSON");
  }

  return validateResponse(parsed);
}

