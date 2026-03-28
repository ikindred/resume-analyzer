import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse, PasswordException } from "pdf-parse";
import { analyzeResume } from "@/lib/analyzeResume";
import { getResumeFileKind } from "@/lib/resumeFileFormats";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  let parser: PDFParse | null = null;

  try {
    const formData = await request.formData();
    const entry = formData.get("file");

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

    let text: string;

    if (kind === "pdf") {
      parser = new PDFParse({ data: buffer });
      let textResult;
      try {
        textResult = await parser.getText();
      } catch (e) {
        const isPassword =
          e instanceof PasswordException ||
          (e instanceof Error && e.name === "PasswordException");
        if (isPassword) {
          return NextResponse.json(
            {
              error:
                "This PDF is password-protected. Remove the password and try again.",
            },
            { status: 400 },
          );
        }
        throw e;
      }
      text = textResult.text?.trim() ?? "";
      if (!text.length) {
        return NextResponse.json(
          {
            error:
              "Could not extract text from this PDF. It may be empty, scanned, or image-only.",
          },
          { status: 400 },
        );
      }
    } else {
      try {
        const raw = await mammoth.extractRawText({ buffer });
        text = raw.value?.trim() ?? "";
      } catch {
        return NextResponse.json(
          {
            error:
              "Could not read this Word file. It may be corrupted or not a valid .docx.",
          },
          { status: 400 },
        );
      }
      if (!text.length) {
        return NextResponse.json(
          {
            error:
              "Could not extract text from this document. It may be empty.",
          },
          { status: 400 },
        );
      }
    }

    const analysis = await analyzeResume(text);
    return NextResponse.json(analysis);
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
      message.includes("Empty response from model")
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
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        /* ignore */
      }
    }
  }
}
