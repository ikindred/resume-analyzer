"use client";

import { useCallback, useState } from "react";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ResumeResult } from "@/components/ResumeResult";
import { UploadZone } from "@/components/UploadZone";
import type { ResumeAnalysis } from "@/lib/analyzeResume";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeAnalysis | null>(null);

  const onFileSelect = useCallback((f: File | null, hint: string | null) => {
    setFile(f);
    setUploadHint(hint);
    setError(null);
    setResult(null);
  }, []);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setUploadHint(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

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

      setResult(data as ResumeAnalysis);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setUploadHint(null);
    setError(null);
    setResult(null);
    setLoading(false);
  };

  const hint = uploadHint || error;

  return (
    <div className="min-h-screen bg-navy-950 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <header className="mb-10 text-center md:mb-14">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            HR intelligence
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            ResumeIQ
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-slate-400">
            Upload a PDF or Word (.docx) resume—exported from Microsoft Word or
            Google Docs—for an AI-powered summary, skills overview, and hiring
            recommendation.
          </p>
        </header>

        <div className="space-y-6">
          <UploadZone
            onFileSelect={onFileSelect}
            selectedFile={file}
            loading={loading}
          />

          {hint && (
            <div
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
              role="alert"
            >
              {hint}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={analyze}
              disabled={!file || loading}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-navy-950 shadow-lg shadow-accent/20 transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Analyze Resume"}
            </button>
          </div>

          {loading && <LoadingSkeleton />}

          {result && !loading && <ResumeResult data={result} />}

          {(result || error) && !loading && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={reset}
                className="text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
              >
                Analyze another resume
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
