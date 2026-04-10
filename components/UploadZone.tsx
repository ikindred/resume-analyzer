"use client";

import { useCallback, useRef } from "react";
import { getResumeFileKind } from "@/lib/resumeFileFormats";

const MAX_BYTES = 5 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type UploadZoneProps = {
  onFileSelect: (file: File | null, error: string | null) => void;
  selectedFile: File | null;
  loading?: boolean;
};

export function UploadZone({
  onFileSelect,
  selectedFile,
  loading = false,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback(
    (file: File | null) => {
      if (!file) {
        onFileSelect(null, null);
        return;
      }
      if (!getResumeFileKind(file)) {
        onFileSelect(
          null,
          "Please choose a PDF or Word file (.pdf or .docx).",
        );
        return;
      }
      if (file.size > MAX_BYTES) {
        onFileSelect(null, "File must be 5MB or smaller.");
        return;
      }
      onFileSelect(file, null);
    },
    [onFileSelect],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    validateAndSet(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    const file = e.dataTransfer.files?.[0] ?? null;
    validateAndSet(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const disabled = loading;

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="group relative flex min-h-[180px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center transition-colors hover:border-accent/60 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-navy-500/50 dark:bg-white/5 dark:hover:bg-white/[0.07] dark:focus-visible:ring-offset-navy-950"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
          aria-hidden
        />
        <div className="pointer-events-none flex flex-col items-center gap-2">
          <span className="rounded-full bg-accent/15 p-3 text-accent">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </span>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Drag and drop a resume here, or{" "}
            <span className="text-accent underline decoration-accent/50 underline-offset-2 group-hover:decoration-accent">
              browse
            </span>
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-500">
            PDF or Word (.docx) · max 5MB
          </p>
        </div>
      </button>

      {selectedFile && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-200">
            {selectedFile.name}
          </span>
          <span className="mx-2 text-slate-400 dark:text-slate-600">·</span>
          {formatBytes(selectedFile.size)}
        </p>
      )}
    </div>
  );
}
