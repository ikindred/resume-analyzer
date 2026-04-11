/**
 * Models shown in the UI and accepted from the client for resume analysis
 * (extraction + screening). Server default can still be set with OPENAI_ANALYZE_MODEL.
 */

export const DEFAULT_ANALYSIS_MODEL = "gpt-4o-mini";

export const ANALYSIS_MODEL_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "gpt-4o-mini", label: "GPT-4o mini — fast, lower cost" },
  { id: "gpt-4o", label: "GPT-4o — higher quality" },
];

const ALLOWED = new Set(ANALYSIS_MODEL_OPTIONS.map((m) => m.id));

const SAFE_MODEL_ID = /^[a-zA-Z0-9._-]+$/;

/**
 * Pick the chat model for analyze/rank. User-supplied values must be in
 * {@link ANALYSIS_MODEL_OPTIONS}; otherwise falls back to env then default.
 */
export function resolveAnalysisModel(requested: string | undefined | null): string {
  const r = requested?.trim();
  if (r && ALLOWED.has(r)) return r;

  const envDefault = process.env.OPENAI_ANALYZE_MODEL?.trim();
  if (envDefault && SAFE_MODEL_ID.test(envDefault)) return envDefault;

  return DEFAULT_ANALYSIS_MODEL;
}
