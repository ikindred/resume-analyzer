import type { RankApiResponse } from "@/lib/rankResult";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function buildRankingCsv(data: RankApiResponse): string {
  const lines: string[] = [];
  const header = [
    "rank",
    "fileName",
    "candidateName",
    "rankScore",
    "recommendation",
    "fitScore",
    "interviewYes",
    "criteriaRatings",
    "goodThings",
    "badThings",
  ];
  lines.push(header.join(","));

  for (const c of data.candidates) {
    const a = c.analysis;
    const interviewYes =
      a.recommendation === "Strong Candidate" ||
      a.recommendation === "Consider for Interview";

    const criteriaRatings = (a.criteriaRatings ?? [])
      .slice(0, 10)
      .map((cr) => `${cr.criterion}=${cr.rating}/5`)
      .join(" | ");

    const goodThings = (a.goodThings ?? []).slice(0, 6).join(" | ");
    const badThings = (a.badThings ?? []).slice(0, 6).join(" | ");

    const row = [
      c.rank,
      c.fileName,
      a.candidateName,
      c.rankScore.toFixed(1),
      a.recommendation,
      a.assessment.fitScore,
      interviewYes ? "Yes" : "No",
      criteriaRatings,
      goodThings,
      badThings,
    ].map(csvEscape);

    lines.push(row.join(","));
  }

  if (data.failed.length > 0) {
    lines.push("");
    lines.push("failed_fileName,failed_error");
    for (const f of data.failed) {
      lines.push([csvEscape(f.fileName), csvEscape(f.error ?? "")].join(","));
    }
  }

  return lines.join("\n");
}

