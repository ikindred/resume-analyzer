"use client";

import type { RankedCandidate } from "@/lib/rankResult";
import type { Recommendation } from "@/lib/analyzeResume";

function badgeClass(r: Recommendation): string {
  switch (r) {
    case "Strong Candidate":
      return "border-emerald-600/30 bg-emerald-50 text-emerald-900";
    case "Consider for Interview":
      return "border-amber-600/30 bg-amber-50 text-amber-950";
    default:
      return "border-rose-600/30 bg-rose-50 text-rose-950";
  }
}

function FitScoreBar({ fitScore }: { fitScore: number }) {
  const clamped = Math.max(1, Math.min(10, fitScore));
  const pct = (clamped / 10) * 100;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Fit score</span>
        <span className="tabular-nums">{clamped}/10</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RatingDots({ rating }: { rating: number }) {
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <div className="flex items-center gap-1" aria-label={`${r} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < r ? "bg-accent" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

type Props = {
  candidates: RankedCandidate[];
  onClose: () => void;
};

export function CandidateComparison({ candidates, onClose }: Props) {
  const cols = candidates.slice(0, 3);

  const criterionSet = new Set<string>();
  for (const c of cols) {
    for (const cr of c.analysis.criteriaRatings ?? []) {
      if (cr.criterion?.trim()) criterionSet.add(cr.criterion.trim());
    }
  }
  const criteria = Array.from(criterionSet);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-navy-900/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Candidate comparison
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Side-by-side view of key signals and criteria ratings.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Close
        </button>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-3">
        {cols.map((c) => {
          const a = c.analysis;
          return (
            <div
              key={`${c.rank}-${c.fileName}`}
              className="rounded-xl border border-white/10 bg-navy-950/40 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold tabular-nums text-accent">
                  #{c.rank}
                </span>
                <span className="text-base font-semibold text-white">
                  {a.candidateName || "Unknown candidate"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{c.fileName}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-300">
                  Score {c.rankScore.toFixed(1)}/100
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                    a.recommendation,
                  )}`}
                >
                  {a.recommendation}
                </span>
              </div>

              <FitScoreBar fitScore={a.assessment.fitScore} />

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase text-slate-500">
                  Good signals
                </h3>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-300">
                  {(a.goodThings?.length ? a.goodThings : ["—"]).map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase text-slate-500">
                  Risks / gaps
                </h3>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-300">
                  {(a.badThings?.length ? a.badThings : ["—"]).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase text-slate-500">
                  Criteria ratings
                </h3>
                {criteria.length === 0 ? (
                  <p className="mt-1.5 text-sm text-slate-500">—</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-slate-300">
                    {criteria.map((criterion) => {
                      const cr = (a.criteriaRatings ?? []).find(
                        (x) => x.criterion?.trim() === criterion,
                      );
                      const rating = cr?.rating ?? 0;
                      return (
                        <li
                          key={criterion}
                          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-slate-200">
                              {criterion}
                            </span>
                            {rating ? (
                              <RatingDots rating={rating} />
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </div>
                          {cr?.evidence ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {cr.evidence}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

