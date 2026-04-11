import { NextResponse } from "next/server";
import { analyzeResume } from "@/lib/analyzeResume";
import { extractNameFromPdfVision } from "@/lib/extractNameFromPdfVision";
import { extractResumeText } from "@/lib/extractResumeText";
import { parseHrCriteriaJson } from "@/lib/hrCriteria";
import { getResumeFileKind } from "@/lib/resumeFileFormats";
import { transcribeScannedPdfVision } from "@/lib/transcribeScannedPdfVision";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    const criteria = parseHrCriteriaJson(
      typeof formData.get("criteria") === "string"
        ? (formData.get("criteria") as string)
        : null,
    );

    const modelField = formData.get("model");
    const requestedModel =
      typeof modelField === "string" ? modelField : undefined;

    if (!(entry instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Missing file field. Upload a PDF or Word (.docx) using the 'file' field.",
        },
        { status: 400 },
      );
    }

    const kind = getResumeFileKind(entry);
    if (!kind) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Upload a PDF or Word document (.docx). Legacy .doc is not supported—save as .docx or PDF and try again.",
        },
        { status: 400 },
      );
    }

    if (entry.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 5MB." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    const extracted = await extractResumeText(kind, buffer, {
      preserveEmptyPdfForOcr: kind === "pdf",
    });

    if ("error" in extracted) {
      switch (extracted.error.kind) {
        case "password_pdf":
          return NextResponse.json(
            {
              error:
                "This PDF is password-protected. Remove the password and try again.",
            },
            { status: 400 },
          );
        case "empty_pdf":
          return NextResponse.json(
            {
              error:
                "Could not extract text from this PDF. It may be empty, scanned, or image-only.",
            },
            { status: 400 },
          );
        case "bad_docx":
          return NextResponse.json(
            {
              error:
                "Could not read this Word file. It may be corrupted or not a valid .docx.",
            },
            { status: 400 },
          );
        case "empty_docx":
          return NextResponse.json(
            {
              error:
                "Could not extract text from this document. It may be empty.",
            },
            { status: 400 },
          );
      }
    }

    let resumeText = extracted.text;
    let extractedTextForClient = extracted.text;

    if (
      kind === "pdf" &&
      extracted.pdfTextKind === "image-only"
    ) {
      const ocrText = await transcribeScannedPdfVision(buffer);
      const ocrTrimmed = ocrText?.trim() ?? "";
      if (ocrTrimmed.length < 100) {
        return NextResponse.json(
          {
            error:
              "Could not extract text from this resume. Please upload a text-based PDF or a clearer scan.",
          },
          { status: 400 },
        );
      }
      resumeText = ocrTrimmed;
      extractedTextForClient = ocrTrimmed;
    }

    let visionName = "";
    if (kind === "pdf" && extracted.pdfTextKind !== "image-only") {
      visionName = await extractNameFromPdfVision(buffer);
    }

    const analysis = await analyzeResume(resumeText, criteria, {
      fileName: entry.name,
      model: requestedModel,
    });

    if (kind === "pdf" && visionName.trim()) {
      const visionTrimmed = visionName.trim();
      const visionTokens = visionTrimmed.split(/\s+/).filter(Boolean).length;
      const extractedName = analysis.candidateName?.trim() ?? "";
      const extractedTokens = extractedName.length
        ? extractedName.split(/\s+/).filter(Boolean).length
        : 0;
      if (visionTokens > extractedTokens) {
        analysis.candidateName = visionTrimmed;
      }
    }

    return NextResponse.json({
      analysis,
      extractedText: extractedTextForClient,
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

    if (
      message.includes("Analysis must") ||
      message.includes("Missing or invalid") ||
      message.includes("Invalid recommendation") ||
      message.includes("fitScore") ||
      message.includes("Model returned invalid JSON") ||
      message.includes("Empty response from model") ||
      message.includes("(extraction)") ||
      message.includes("(screening)")
    ) {
      return NextResponse.json(
        { error: "Could not parse AI response. Please try again." },
        { status: 502 },
      );
    }

    console.error("[analyze]", err);
    return NextResponse.json(
      { error: "Something went wrong while analyzing the resume." },
      { status: 500 },
    );
  }
}
