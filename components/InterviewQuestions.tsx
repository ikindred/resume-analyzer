"use client";

import { useState } from "react";
import type { ResumeAnalysis } from "@/lib/analyzeResume";
import type { HrCriteria } from "@/lib/hrCriteria";

type Question = {
  topic: string;
  question: string;
  why: string;
};

type Props = {
  analysis: ResumeAnalysis;
  criteria: HrCriteria;
};

export function InterviewQuestions({ analysis, criteria }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/interview-questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysis, criteria }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof json.error === "string"
            ? json.error
            : "Could not generate questions. Please try again.",
        );
        return;
      }
      setQuestions(Array.isArray(json.questions) ? json.questions : []);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 sm:px-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800">
            Interview questions
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Generated from the resume analysis and your criteria.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Generating…" : questions ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error ? (
        <div
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {questions ? (
        questions.length ? (
          <ol className="mt-5 space-y-4 text-sm text-slate-800">
            {questions.map((q, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {q.topic}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-slate-900">{q.question}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {q.why}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No questions returned.</p>
        )
      ) : (
        <p className="mt-4 text-sm text-slate-600">
          Click Generate to create a tailored interview plan.
        </p>
      )}
    </section>
  );
}

