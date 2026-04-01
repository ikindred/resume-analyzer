import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseHrCriteriaJson } from "@/lib/hrCriteria";

export const runtime = "nodejs";

const MAX_JD_CHARS = 20_000;

function buildSystemPrompt(): string {
  return `You are an expert HR recruiter. Convert the provided job description into an HR screening criteria JSON object.\n\nRespond with ONLY a valid JSON object (no markdown, no prose outside JSON).\n\nThe JSON must match this exact shape and key names:\n{\n  \"mustHaveSkills\": [\"string\"],\n  \"niceToHaveSkills\": [\"string\"],\n  \"softSkills\": [\"string\"],\n  \"personalityTraits\": [\"string\"],\n  \"achievements\": [\"string\"],\n  \"schools\": [\"string\"],\n  \"minAge\": null,\n  \"maxAge\": null,\n  \"minYearsExperience\": null,\n  \"maxGapMonthsAfterCompany\": null,\n  \"maxGapMonthsAfterGraduation\": null,\n  \"maxCompanies\": null,\n  \"notes\": \"string\"\n}\n\nRules:\n- Use arrays of strings for list fields; use [] if not specified.\n- Only set numeric fields when explicitly stated or strongly implied by the job description; otherwise use null.\n- Do not invent age requirements.\n- Keep list entries short and specific (e.g. \"React\", \"Node.js\", \"PostgreSQL\").\n- Put anything ambiguous or non-structurable into \"notes\".\n- Keep the output compatible with JSON.parse.`;
}

export async function POST(request: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key?.trim()) {
      return NextResponse.json(
        { error: "Resume analysis is not configured on the server." },
        { status: 500 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { jobDescription?: unknown }
      | null;

    const raw = body?.jobDescription;
    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json(
        { error: "Missing jobDescription. Paste a job description and try again." },
        { status: 400 },
      );
    }

    const jd =
      raw.length > MAX_JD_CHARS ? raw.slice(0, MAX_JD_CHARS) : raw;

    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: `Job description:\n\n${jd}` },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Empty response from model. Please try again." },
        { status: 502 },
      );
    }

    const criteria = parseHrCriteriaJson(content);
    return NextResponse.json(criteria);
  } catch (err) {
    console.error("[extract-criteria]", err);
    return NextResponse.json(
      { error: "Something went wrong while extracting criteria." },
      { status: 500 },
    );
  }
}

