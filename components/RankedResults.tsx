"use client";

import { useEffect, useMemo, useState } from "react";
import { CandidateComparison } from "@/components/CandidateComparison";
import { buildRankingCsv } from "@/lib/csvExport";
import { downloadRankingPdf } from "@/lib/pdfReport";
import type { RankApiResponse } from "@/lib/rankResult";
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

function interviewYes(r: Recommendation): boolean {
  return r === "Strong Candidate" || r === "Consider for Interview";
}

type Props = {
  data: RankApiResponse;
};

export function RankedResults({ data }: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [saveBusyId, setSaveBusyId] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [jdItems, setJdItems] = useState<
    Array<{ id: string; title: string | null; jd_text: string }>
  >([]);
  const [jdId, setJdId] = useState<string>("");

  const onPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadRankingPdf(
        data.criteria,
        data.candidates,
        data.failed,
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const onCsv = () => {
    setCsvBusy(true);
    try {
      const csv = buildRankingCsv(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resumeiq-ranking.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setCsvBusy(false);
    }
  };

  const selected = data.candidates.filter((c) => selectedIds.has(c.fileName));
  const compareReady = selected.length >= 2 && selected.length <= 3;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/jds");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const items: unknown[] = Array.isArray(json.items) ? (json.items as unknown[]) : [];
        if (!cancelled) {
          setJdItems(
            items
              .filter((x): x is { id: string; title: string | null; jd_text: string } => {
                if (typeof x !== "object" || x === null) return false;
                const o = x as Record<string, unknown>;
                return typeof o.id === "string";
              })
              .map((x) => {
                const o = x as Record<string, unknown>;
                return {
                  id: String(o.id),
                  title: typeof o.title === "string" ? o.title : null,
                  jd_text: typeof o.jd_text === "string" ? o.jd_text : "",
                };
              }),
          );
        }
      } catch {
        // ignore: saving candidates still works without JD linking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const jdOptions = useMemo(() => {
    return jdItems.map((jd) => {
      const title =
        jd.title?.trim() ||
        (jd.jd_text.trim()
          ? `${jd.jd_text.trim().slice(0, 60)}${jd.jd_text.trim().length > 60 ? "…" : ""}`
          : "Untitled JD");
      return { id: jd.id, label: title };
    });
  }, [jdItems]);

  const saveCandidate = async (fileName: string) => {
    const c = data.candidates.find((x) => x.fileName === fileName);
    if (!c) return;
    setSaveBusyId(fileName);
    setSaveHint(null);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobDescriptionId: jdId || undefined,
          fileName: c.fileName,
          rank: c.rank,
          rankScore: c.rankScore,
          analysis: c.analysis,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveHint(
          typeof json.error === "string"
            ? json.error
            : "Could not save candidate.",
        );
        return;
      }
      setSaveHint("Saved candidate. View it in Saved.");
    } catch {
      setSaveHint("Network error while saving.");
    } finally {
      setSaveBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Ranking results
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-white/15 dark:bg-white/10">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Link JD
            </span>
            <select
              value={jdId}
              onChange={(e) => setJdId(e.target.value)}
              className="h-9 max-w-[240px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-navy-950/40 dark:text-slate-200"
            >
              <option value="">None</option>
              {jdOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            disabled={!compareReady}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-navy-950 shadow-lg shadow-accent/20 transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Compare ({selected.length})
          </button>
          <button
            type="button"
            onClick={onCsv}
            disabled={csvBusy || data.candidates.length === 0}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            {csvBusy ? "Building CSV…" : "Download CSV"}
          </button>
          <button
            type="button"
            onClick={onPdf}
            disabled={pdfBusy || data.candidates.length === 0}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            {pdfBusy ? "Building PDF…" : "Download PDF report"}
          </button>
        </div>
      </div>

      {saveHint ? (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          role="status"
        >
          {saveHint}{" "}
          <a className="font-semibold text-accent underline" href="/saved">
            Open Saved
          </a>
        </div>
      ) : null}

      {compareOpen && compareReady ? (
        <CandidateComparison
          candidates={selected}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}

      {data.failed.length > 0 ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">Some files could not be processed</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800/90 dark:text-amber-100/90">
            {data.failed.map((f) => (
              <li key={f.fileName}>
                {f.fileName}
                {f.error ? ` — ${f.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="space-y-4">
        {data.candidates.map((c) => {
          const a = c.analysis;
          const yes = interviewYes(a.recommendation);
          const checked = selectedIds.has(c.fileName);
          const canToggle = checked || selectedIds.size < 3;
          return (
            <li
              key={`${c.rank}-${c.fileName}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-navy-900/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-accent">
                    #{c.rank}
                  </span>
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">
                    {a.candidateName || "Unknown candidate"}
                  </span>
                  <span className="text-sm text-slate-500">{c.fileName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canToggle}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.fileName)) next.delete(c.fileName);
                          else next.add(c.fileName);
                          return next;
                        });
                        setCompareOpen(false);
                      }}
                      className="h-4 w-4 accent-[color:var(--accent)]"
                    />
                    Compare
                  </label>
                  <button
                    type="button"
                    onClick={() => saveCandidate(c.fileName)}
                    disabled={saveBusyId === c.fileName}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    {saveBusyId === c.fileName ? "Saving…" : "Save"}
                  </button>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Score {c.rankScore.toFixed(1)}/100
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(a.recommendation)}`}
                  >
                    {a.recommendation}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${yes ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200" : "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200"}`}
                  >
                    Interview: {yes ? "Yes" : "No"}
                  </span>
                </div>
              </div>
              <div className="grid gap-4 px-4 py-4 text-sm md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Good signals
                  </h3>
                  <ul className="mt-1.5 list-inside list-disc space-y-1 text-slate-700 dark:text-slate-300">
                    {(a.goodThings?.length ? a.goodThings : ["—"]).map(
                      (g, i) => (
                        <li key={i}>{g}</li>
                      ),
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Risks / gaps
                  </h3>
                  <ul className="mt-1.5 list-inside list-disc space-y-1 text-slate-700 dark:text-slate-300">
                    {(a.badThings?.length ? a.badThings : ["—"]).map(
                      (b, i) => (
                        <li key={i}>{b}</li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
              <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                <span className="font-medium text-slate-600 dark:text-slate-500">
                  Criteria highlights:{" "}
                </span>
                {(a.criteriaRatings ?? [])
                  .slice(0, 4)
                  .map((cr) => `${cr.criterion} (${cr.rating}/5)`)
                  .join(" · ") || "—"}
              </div>
            </li>
          );
        })}
      </ol>

      {data.candidates.length === 0 ? (
        <p className="text-center text-sm text-slate-600 dark:text-slate-500">
          No successful analyses. Fix uploads above and try again.
        </p>
      ) : null}
    </div>
  );
}
