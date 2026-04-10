"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HrCriteriaForm } from "@/components/HrCriteriaForm";
import { JobDescriptionInput } from "@/components/JobDescriptionInput";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { MultiUploadZone } from "@/components/MultiUploadZone";
import { RankedResults } from "@/components/RankedResults";
import { ResumeResult } from "@/components/ResumeResult";
import { UploadZone } from "@/components/UploadZone";
import type { ResumeAnalysis } from "@/lib/analyzeResume";
import { EMPTY_HR_CRITERIA, type HrCriteria } from "@/lib/hrCriteria";
import type { RankApiResponse } from "@/lib/rankResult";
import {
  downloadFormattedResumePdf,
  downloadSingleResumePdf,
} from "@/lib/pdfReport";
import { ThemeToggle } from "@/components/ThemeToggle";

type Mode = "single" | "batch";
type CriteriaInputMode = "manual" | "jd";

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [criteria, setCriteria] = useState<HrCriteria>(EMPTY_HR_CRITERIA);
  const [criteriaInputMode, setCriteriaInputMode] =
    useState<CriteriaInputMode>("manual");
  const [singlePdfBusy, setSinglePdfBusy] = useState(false);
  const [formattedResumeBusy, setFormattedResumeBusy] = useState(false);
  const [presetItems, setPresetItems] = useState<
    Array<{ id: string; name: string; criteria: HrCriteria }>
  >([]);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetSaveBusy, setPresetSaveBusy] = useState(false);
  const [presetSelectedId, setPresetSelectedId] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeAnalysis | null>(null);
  const [rankResult, setRankResult] = useState<RankApiResponse | null>(null);

  const onFileSelect = useCallback((f: File | null, hint: string | null) => {
    setFile(f);
    setUploadHint(hint);
    setError(null);
    setResult(null);
    setRankResult(null);
  }, []);

  const onBatchFilesChange = useCallback(
    (files: File[], hint: string | null) => {
      setBatchFiles(files);
      setUploadHint(hint);
      setError(null);
      setResult(null);
      setRankResult(null);
    },
    [],
  );

  const criteriaJson = JSON.stringify(criteria);

  type PresetApiItem = { id: string; name: string; criteria: HrCriteria };

  const loadPresets = useCallback(async () => {
    setPresetLoading(true);
    setPresetError(null);
    try {
      const res = await fetch("/api/criteria-presets");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPresetError(
          typeof json.error === "string"
            ? json.error
            : "Could not load presets.",
        );
        return;
      }
      const items: unknown[] = Array.isArray(json.items) ? (json.items as unknown[]) : [];
      setPresetItems(
        items
          .filter((x): x is PresetApiItem => {
            if (typeof x !== "object" || x === null) return false;
            const o = x as Record<string, unknown>;
            return (
              typeof o.id === "string" &&
              typeof o.name === "string" &&
              typeof o.criteria === "object" &&
              o.criteria !== null
            );
          })
          .map((x) => ({ id: x.id, name: x.name, criteria: x.criteria })),
      );
    } catch {
      setPresetError("Network error while loading presets.");
    } finally {
      setPresetLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const presetOptions = useMemo(() => {
    return presetItems.map((p) => ({ id: p.id, name: p.name }));
  }, [presetItems]);

  const onApplyPreset = (id: string) => {
    setPresetSelectedId(id);
    const p = presetItems.find((x) => x.id === id);
    if (p) setCriteria(p.criteria);
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      setPresetError("Enter a preset name first.");
      return;
    }
    setPresetSaveBusy(true);
    setPresetError(null);
    try {
      const res = await fetch("/api/criteria-presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, criteria }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPresetError(
          typeof json.error === "string"
            ? json.error
            : "Could not save preset.",
        );
        return;
      }
      setPresetName("");
      await loadPresets();
    } catch {
      setPresetError("Network error while saving preset.");
    } finally {
      setPresetSaveBusy(false);
    }
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setUploadHint(null);
    setResult(null);
    setRankResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("criteria", criteriaJson);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Analysis failed. Please try again.";
        setError(msg);
        return;
      }

      if (data && typeof data === "object" && "analysis" in data) {
        setResult((data as { analysis: ResumeAnalysis }).analysis);
      } else {
        setResult(data as ResumeAnalysis);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const rankApplicants = async () => {
    if (batchFiles.length === 0) return;
    setLoading(true);
    setError(null);
    setUploadHint(null);
    setResult(null);
    setRankResult(null);

    const formData = new FormData();
    batchFiles.forEach((f) => formData.append("files", f));
    formData.append("criteria", criteriaJson);

    try {
      const res = await fetch("/api/rank", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Ranking failed. Please try again.";
        setError(msg);
        return;
      }

      setRankResult(data as RankApiResponse);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setBatchFiles([]);
    setUploadHint(null);
    setError(null);
    setResult(null);
    setRankResult(null);
    setLoading(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setUploadHint(null);
    setError(null);
    setResult(null);
    setRankResult(null);
    setFile(null);
    setBatchFiles([]);
  };

  const hint = uploadHint || error;

  const busy = loading;
  const canRunSingle = mode === "single" && file && !busy;
  const canRunBatch = mode === "batch" && batchFiles.length > 0 && !busy;
  const pdfDownloadBusy = singlePdfBusy || formattedResumeBusy;
  const canDownloadSinglePdf =
    mode === "single" && !!result && !busy && !pdfDownloadBusy;

  return (
    <div className="min-h-screen bg-slate-100 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:bg-navy-950 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <div className="mb-6 flex justify-end">
          <ThemeToggle />
        </div>
        <header className="mb-10 text-center md:mb-14">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            HR intelligence
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
            ResumeIQ
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-slate-600 dark:text-slate-400">
            Set screening criteria, then analyze one resume or rank up to 10
            applicants with AI scoring and a PDF report.
          </p>
        </header>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Criteria input
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-500">
                  Fill manually, or paste a job description and extract criteria.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCriteriaInputMode("manual")}
                  disabled={busy}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${criteriaInputMode === "manual"
                      ? "bg-accent text-navy-950"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                    }`}
                >
                  Manual criteria
                </button>
                <button
                  type="button"
                  onClick={() => setCriteriaInputMode("jd")}
                  disabled={busy}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 ${criteriaInputMode === "jd"
                      ? "bg-accent text-navy-950"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                    }`}
                >
                  Paste job description
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Load preset
                </label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    value={presetSelectedId}
                    onChange={(e) => onApplyPreset(e.target.value)}
                    disabled={presetLoading || busy}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-navy-950/40 dark:text-slate-200"
                  >
                    <option value="">
                      {presetLoading ? "Loading…" : "Select a preset"}
                    </option>
                    {presetOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadPresets()}
                    disabled={presetLoading || busy}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    Refresh
                  </button>
                </div>
                {presetError ? (
                  <p className="mt-2 text-xs text-rose-700 dark:text-rose-200">
                    {presetError}
                  </p>
                ) : null}
              </div>

              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Save as preset
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    disabled={presetSaveBusy || busy}
                    placeholder="e.g. Senior React Engineer"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-navy-950/40 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => void savePreset()}
                    disabled={presetSaveBusy || busy}
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-navy-950 shadow-lg shadow-accent/20 transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {presetSaveBusy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>

            {criteriaInputMode === "jd" ? (
              <JobDescriptionInput
                disabled={busy}
                onExtracted={(next) => {
                  setCriteria(next);
                  setCriteriaInputMode("manual");
                }}
              />
            ) : null}

            <HrCriteriaForm
              value={criteria}
              onChange={setCriteria}
              disabled={busy}
            />
          </div>

          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => switchMode("single")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${mode === "single"
                  ? "bg-accent text-navy-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                }`}
            >
              Analyze one resume
            </button>
            <button
              type="button"
              onClick={() => switchMode("batch")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${mode === "batch"
                  ? "bg-accent text-navy-950"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                }`}
            >
              Rank up to 10
            </button>
          </div>

          {mode === "single" ? (
            <UploadZone
              onFileSelect={onFileSelect}
              selectedFile={file}
              loading={busy}
            />
          ) : (
            <MultiUploadZone
              files={batchFiles}
              onFilesChange={onBatchFilesChange}
              loading={busy}
            />
          )}

          {hint && (
            <div
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
              role="alert"
            >
              {hint}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {mode === "single" ? (
              <button
                type="button"
                onClick={analyze}
                disabled={!canRunSingle}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-navy-950 shadow-lg shadow-accent/20 transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-navy-950"
              >
                {busy ? "Analyzing…" : "Analyze resume"}
              </button>
            ) : (
              <button
                type="button"
                onClick={rankApplicants}
                disabled={!canRunBatch}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-navy-950 shadow-lg shadow-accent/20 transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-navy-950"
              >
                {busy ? "Ranking…" : "Rank applicants"}
              </button>
            )}
          </div>

          {busy && <LoadingSkeleton />}

          {result && !busy && mode === "single" && (
            <div className="space-y-3">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!result) return;
                    setFormattedResumeBusy(true);
                    try {
                      await downloadFormattedResumePdf(result);
                    } finally {
                      setFormattedResumeBusy(false);
                    }
                  }}
                  disabled={!canDownloadSinglePdf}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  {formattedResumeBusy ? "Building PDF…" : "Formatted Resume"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!result) return;
                    setSinglePdfBusy(true);
                    try {
                      await downloadSingleResumePdf(criteria, result);
                    } finally {
                      setSinglePdfBusy(false);
                    }
                  }}
                  disabled={!canDownloadSinglePdf}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  {singlePdfBusy ? "Building PDF…" : "AI Result"}
                </button>
              </div>
              <ResumeResult data={result} criteria={criteria} />
            </div>
          )}

          {rankResult && !busy && mode === "batch" && (
            <RankedResults data={rankResult} />
          )}

          {(result || rankResult || error) && !busy && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
