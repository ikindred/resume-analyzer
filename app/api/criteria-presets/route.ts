import { NextResponse } from "next/server";
import type { HrCriteria } from "@/lib/hrCriteria";
import { parseHrCriteriaJson } from "@/lib/hrCriteria";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = getPool();
    const res = await pool.query(
      "SELECT id, name, criteria, created_at FROM criteria_presets ORDER BY created_at DESC LIMIT 50",
    );
    return NextResponse.json({ items: res.rows });
  } catch (err) {
    console.error("[criteria-presets][get]", err);
    return NextResponse.json(
      { error: "Failed to load criteria presets." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const pool = getPool();
    const body = (await request.json().catch(() => null)) as
      | { name?: unknown; criteria?: unknown }
      | null;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Missing preset name." }, { status: 400 });
    }

    const criteriaRaw = body?.criteria;
    const criteria: HrCriteria = parseHrCriteriaJson(
      typeof criteriaRaw === "string"
        ? criteriaRaw
        : JSON.stringify(criteriaRaw ?? null),
    );

    const saved = await pool.query<{ id: string }>(
      "INSERT INTO criteria_presets (name, criteria) VALUES ($1, $2) RETURNING id",
      [name, criteria],
    );

    return NextResponse.json({ id: saved.rows[0]?.id });
  } catch (err) {
    // Unique name collisions will show as 500 unless we special-case; keep simple for now.
    console.error("[criteria-presets][post]", err);
    return NextResponse.json(
      { error: "Failed to save criteria preset." },
      { status: 500 },
    );
  }
}

