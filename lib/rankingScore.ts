import type { ResumeAnalysis } from "@/lib/analyzeResume";

/**
 * Deterministic 0–100 score for ordering candidates.
 * Uses average criteria rating (1–5 → scaled) and fitScore (1–10).
 */
export function computeRankScore(analysis: ResumeAnalysis): number {
  const fit = analysis.assessment.fitScore;
  const ratings = analysis.criteriaRatings ?? [];
  if (ratings.length === 0) {
    return Math.round((fit / 10) * 100);
  }
  const sum = ratings.reduce((s, r) => s + r.rating, 0);
  const avg = sum / ratings.length; // 1–5
  const critOn10 = ((avg - 1) / 4) * 10; // map 1–5 → 0–10
  const combined = 0.45 * critOn10 + 0.55 * fit;
  return Math.round((combined / 10) * 1000) / 10; // one decimal 0–100
}
