"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ResumeAnalysis } from "@/lib/analyzeResume";

type SavedJd = {
  id: string;
  title: string | null;
  jd_text: string;
  criteria: unknown;
  created_at: string;
};

type SavedCandidate = {
  id: string;
  job_description_id: string | null;
  file_name: string;
  rank: number | null;
  rank_score: number | null;
  analysis: ResumeAnalysis;
  created_at: string;
};

export default function SavedPage() {
  const [jds, setJds] = useState<SavedJd[]>([]);
  const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [jdsRes, candRes] = await Promise.all([
          fetch("/api/jds"),
          fetch("/api/candidates"),
        ]);
        const [jdsJson, candJson] = await Promise.all([
          jdsRes.json().catch(() => ({})),
          candRes.json().catch(() => ({})),
        ]);

        if (!jdsRes.ok || !candRes.ok) {
          const msg =
            typeof jdsJson.error === "string"
              ? jdsJson.error
              : typeof candJson.error === "string"
                ? candJson.error
                : "Failed to load saved items.";
          throw new Error(msg);
        }

        if (!cancelled) {
          setJds(Array.isArray(jdsJson.items) ? jdsJson.items : []);
          setCandidates(Array.isArray(candJson.items) ? candJson.items : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load saved items.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const jdById = useMemo(() => {
    const m = new Map<string, SavedJd>();
    for (const jd of jds) m.set(jd.id, jd);
    return m;
  }, [jds]);

  return (
    <div className="min-h-screen bg-slate-100 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:bg-navy-950 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        <div className="mb-6 flex justify-end">
          <ThemeToggle />
        </div>
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Saved
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Your saved job descriptions and candidates.
          </p>
        </header>

        {error ? (
          <div
            className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Job descriptions
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
              Latest 50 saved JDs.
            </p>

            <ul className="mt-4 space-y-3">
              {jds.length === 0 ? (
                <li className="text-sm text-slate-500">—</li>
              ) : (
                jds.map((jd) => (
                  <li
                    key={jd.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-navy-950/40"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {jd.title || "Untitled JD"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(jd.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-300">
                      {jd.jd_text}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Candidates
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
              Latest 100 saved candidates.
            </p>

            <ul className="mt-4 space-y-3">
              {candidates.length === 0 ? (
                <li className="text-sm text-slate-500">—</li>
              ) : (
                candidates.map((c) => {
                  const jd = c.job_description_id
                    ? jdById.get(c.job_description_id)
                    : undefined;
                  const name = c.analysis?.candidateName || "Unknown candidate";
                  return (
                    <li
                      key={c.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-navy-950/40"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(c.created_at).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{c.file_name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-300">
                        {typeof c.rank_score === "number" ? (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-white/10 dark:bg-white/5">
                            Score {c.rank_score.toFixed(1)}/100
                          </span>
                        ) : null}
                        {typeof c.rank === "number" ? (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-white/10 dark:bg-white/5">
                            Rank #{c.rank}
                          </span>
                        ) : null}
                        {c.analysis?.recommendation ? (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-white/10 dark:bg-white/5">
                            {c.analysis.recommendation}
                          </span>
                        ) : null}
                      </div>
                      {jd ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Linked JD: {jd.title || "Untitled JD"}
                        </p>
                      ) : null}
                      {c.analysis?.summary ? (
                        <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-300">
                          {c.analysis.summary}
                        </p>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

