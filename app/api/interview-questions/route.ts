import { NextResponse } from "next/server";
import type { ResumeAnalysis } from "@/lib/analyzeResume";
import type { HrCriteria } from "@/lib/hrCriteria";
import { parseHrCriteriaJson } from "@/lib/hrCriteria";
import { generateInterviewQuestions } from "@/lib/interviewQuestions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { analysis?: unknown; criteria?: unknown }
      | null;

    const analysis = body?.analysis as ResumeAnalysis | undefined;
    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json({ error: "Missing analysis." }, { status: 400 });
    }

    const criteria: HrCriteria = parseHrCriteriaJson(
      typeof body?.criteria === "string"
        ? (body?.criteria as string)
        : JSON.stringify(body?.criteria ?? null),
    );

    const out = await generateInterviewQuestions(analysis, criteria);
    return NextResponse.json(out);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";

    if (
      message.includes("OPENAI_API_KEY") ||
      message.includes("not configured")
    ) {
      return NextResponse.json(
        { error: "Interview questions are not configured on the server." },
        { status: 500 },
      );
    }

    if (
      message.includes("Response must") ||
      message.includes("Missing questions") ||
      message.includes("Invalid question") ||
      message.includes("Model returned invalid JSON") ||
      message.includes("Empty response")
    ) {
      return NextResponse.json(
        { error: "Could not parse AI response. Please try again." },
        { status: 502 },
      );
    }

    console.error("[interview-questions]", err);
    return NextResponse.json(
      { error: "Something went wrong while generating questions." },
      { status: 500 },
    );
  }
}

