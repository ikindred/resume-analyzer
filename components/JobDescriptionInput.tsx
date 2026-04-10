"use client";

import { useMemo, useState } from "react";
import type { HrCriteria } from "@/lib/hrCriteria";
import { parseHrCriteriaJson } from "@/lib/hrCriteria";

type Props = {
  disabled?: boolean;
  onExtracted: (criteria: HrCriteria) => void;
};

export function JobDescriptionInput({ disabled, onExtracted }: Props) {
  const [jobDescription, setJobDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const canExtract = useMemo(() => {
    if (disabled || busy) return false;
    return jobDescription.trim().length >= 40;
  }, [busy, disabled, jobDescription]);

  const extract = async () => {
    if (!canExtract) return;
    setBusy(true);
    setError(null);
    setSavedId(null);
    try {
      const res = await fetch("/api/extract-criteria", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Could not extract criteria. Please try again.";
        setError(msg);
        return;
      }

      // Defensive: ensure the object matches our shape even if the server changes.
      const criteria = parseHrCriteriaJson(JSON.stringify(data));
      onExtracted(criteria);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveJd = async () => {
    if (disabled || saveBusy) return;
    setSaveBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "",
          jobDescription,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Could not save job description. Please try again.";
        setError(msg);
        return;
      }
      setSavedId(typeof data.id === "string" ? data.id : null);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Paste a job description
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          We’ll extract must-haves, nice-to-haves, and thresholds into the
          criteria form for review.
        </p>
      </div>

      <textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        disabled={disabled || busy}
        rows={10}
        placeholder="Paste the job description here…"
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-navy-950/40 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      {error ? (
        <div
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-600 dark:text-slate-500">
          Tip: include responsibilities, requirements, and nice-to-haves.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={saveJd}
            disabled={disabled || saveBusy || jobDescription.trim().length < 40}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            {saveBusy ? "Saving…" : "Save JD"}
          </button>
          <button
            type="button"
            onClick={extract}
            disabled={!canExtract}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-navy-950 shadow-lg shadow-accent/20 transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-navy-950"
          >
            {busy ? "Extracting…" : "Extract criteria"}
          </button>
        </div>
      </div>

      {savedId ? (
        <p className="text-xs text-emerald-800 dark:text-emerald-200">
          Saved. View it in{" "}
          <a className="underline" href="/saved">
            Saved
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

