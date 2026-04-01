import { NextResponse } from "next/server";
import { analyzeResume } from "@/lib/analyzeResume";
import type { ResumeAnalysis } from "@/lib/analyzeResume";
import { extractResumeText } from "@/lib/extractResumeText";
import type { HrCriteria } from "@/lib/hrCriteria";
import { parseHrCriteriaJson } from "@/lib/hrCriteria";
import { computeRankScore } from "@/lib/rankingScore";
import type { RankedCandidate } from "@/lib/rankResult";
import { getResumeFileKind } from "@/lib/resumeFileFormats";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 10;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const criteria: HrCriteria = parseHrCriteriaJson(
      typeof formData.get("criteria") === "string"
        ? (formData.get("criteria") as string)
        : null,
    );

    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one resume using the 'files' field." },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `You can upload at most ${MAX_FILES} resumes at once.` },
        { status: 400 },
      );
    }

    const results: Array<{
      fileName: string;
      analysis: ResumeAnalysis;
      rankScore: number;
      error?: string;
    }> = [];

    for (const file of files) {
      const kind = getResumeFileKind(file);
      if (!kind) {
        results.push({
          fileName: file.name,
          analysis: {} as ResumeAnalysis,
          rankScore: 0,
          error:
            "Invalid file type. Only PDF or .docx.",
        });
        continue;
      }

      if (file.size > MAX_BYTES) {
        results.push({
          fileName: file.name,
          analysis: {} as ResumeAnalysis,
          rankScore: 0,
          error: "File exceeds 5MB.",
        });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractResumeText(kind, buffer);

      if ("error" in extracted) {
        let msg = "Could not read this file.";
        if (extracted.error.kind === "password_pdf") {
          msg = "PDF is password-protected.";
        } else if (extracted.error.kind === "empty_pdf" || extracted.error.kind === "empty_docx") {
          msg = "No extractable text.";
        } else if (extracted.error.kind === "bad_docx") {
          msg = "Invalid or corrupted .docx.";
        }
        results.push({
          fileName: file.name,
          analysis: {} as ResumeAnalysis,
          rankScore: 0,
          error: msg,
        });
        continue;
      }

      try {
        const analysis = await analyzeResume(extracted.text, criteria);
        const rankScore = computeRankScore(analysis);
        results.push({ fileName: file.name, analysis, rankScore });
      } catch (e) {
        results.push({
          fileName: file.name,
          analysis: {} as ResumeAnalysis,
          rankScore: 0,
          error:
            e instanceof Error ? e.message : "Analysis failed for this file.",
        });
      }
    }

    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);

    const sorted = [...ok].sort((a, b) => b.rankScore - a.rankScore);

    const candidates: RankedCandidate[] = sorted.map((r, i) => ({
      rank: i + 1,
      fileName: r.fileName,
      rankScore: r.rankScore,
      analysis: r.analysis,
    }));

    return NextResponse.json({
      criteria,
      candidates,
      failed: failed.map((f) => ({ fileName: f.fileName, error: f.error })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";

    if (
      message.includes("OPENAI_API_KEY") ||
      message.includes("not configured")
    ) {
      return NextResponse.json(
        { error: "Resume analysis is not configured on the server." },
        { status: 500 },
      );
    }

    console.error("[rank]", err);
    return NextResponse.json(
      { error: "Something went wrong while ranking resumes." },
      { status: 500 },
    );
  }
}
