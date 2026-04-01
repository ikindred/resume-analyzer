import { NextResponse } from "next/server";
import type { HrCriteria } from "@/lib/hrCriteria";
import { parseHrCriteriaJson } from "@/lib/hrCriteria";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = getPool();
    const res = await pool.query(
      "SELECT id, title, jd_text, criteria, created_at FROM job_descriptions ORDER BY created_at DESC LIMIT 50",
    );
    return NextResponse.json({ items: res.rows });
  } catch (err) {
    console.error("[jds][get]", err);
    return NextResponse.json(
      { error: "Failed to load saved job descriptions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const pool = getPool();
    const body = (await request.json().catch(() => null)) as
      | {
          title?: unknown;
          jobDescription?: unknown;
          criteria?: unknown;
        }
      | null;

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const jobDescription =
      typeof body?.jobDescription === "string" ? body.jobDescription.trim() : "";

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Missing jobDescription." },
        { status: 400 },
      );
    }

    const criteriaRaw = body?.criteria;
    const criteria: HrCriteria = parseHrCriteriaJson(
      typeof criteriaRaw === "string"
        ? criteriaRaw
        : JSON.stringify(criteriaRaw ?? null),
    );

    const saved = await pool.query<{ id: string }>(
      "INSERT INTO job_descriptions (title, jd_text, criteria) VALUES ($1, $2, $3) RETURNING id",
      [title || null, jobDescription, criteria],
    );

    return NextResponse.json({ id: saved.rows[0]?.id });
  } catch (err) {
    console.error("[jds][post]", err);
    return NextResponse.json(
      { error: "Failed to save job description." },
      { status: 500 },
    );
  }
}

