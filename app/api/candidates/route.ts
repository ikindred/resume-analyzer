import { NextResponse } from "next/server";
import type { ResumeAnalysis } from "@/lib/analyzeResume";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = getPool();
    const res = await pool.query(
      "SELECT id, job_description_id, file_name, rank, rank_score, analysis, created_at FROM saved_candidates ORDER BY created_at DESC LIMIT 100",
    );
    return NextResponse.json({ items: res.rows });
  } catch (err) {
    console.error("[candidates][get]", err);
    return NextResponse.json(
      { error: "Failed to load saved candidates." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const pool = getPool();
    const body = (await request.json().catch(() => null)) as
      | {
          jobDescriptionId?: unknown;
          fileName?: unknown;
          rank?: unknown;
          rankScore?: unknown;
          analysis?: unknown;
        }
      | null;

    const fileName =
      typeof body?.fileName === "string" ? body.fileName.trim() : "";
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName." }, { status: 400 });
    }

    const rank =
      typeof body?.rank === "number" && Number.isFinite(body.rank)
        ? Math.trunc(body.rank)
        : null;
    const rankScore =
      typeof body?.rankScore === "number" && Number.isFinite(body.rankScore)
        ? body.rankScore
        : null;

    const jobDescriptionId =
      typeof body?.jobDescriptionId === "string" && body.jobDescriptionId.trim()
        ? body.jobDescriptionId.trim()
        : null;

    // We store analysis as JSONB; keep this permissive but require object-ish.
    const analysis = body?.analysis as ResumeAnalysis | undefined;
    if (!analysis || typeof analysis !== "object") {
      return NextResponse.json(
        { error: "Missing analysis." },
        { status: 400 },
      );
    }

    const saved = await pool.query<{ id: string }>(
      "INSERT INTO saved_candidates (job_description_id, file_name, rank, rank_score, analysis) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [jobDescriptionId, fileName, rank, rankScore, analysis],
    );

    return NextResponse.json({ id: saved.rows[0]?.id });
  } catch (err) {
    console.error("[candidates][post]", err);
    return NextResponse.json(
      { error: "Failed to save candidate." },
      { status: 500 },
    );
  }
}

