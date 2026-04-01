"use client";

import { useCallback, useRef } from "react";
import { getResumeFileKind } from "@/lib/resumeFileFormats";

const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_FILES = 10;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type MultiUploadZoneProps = {
  files: File[];
  onFilesChange: (files: File[], error: string | null) => void;
  loading?: boolean;
};

function dedupeFiles(list: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of list) {
    const k = `${f.name}:${f.size}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

function validateFiles(list: File[]): { ok: File[]; error: string | null } {
  const next: File[] = [];
  for (const file of list) {
    if (!getResumeFileKind(file)) {
      return {
        ok: [],
        error: "Only PDF or Word (.docx) files are allowed.",
      };
    }
    if (file.size > MAX_BYTES) {
      return {
        ok: [],
        error: `“${file.name}” exceeds 5MB.`,
      };
    }
    next.push(file);
  }
  if (next.length > MAX_RESUME_FILES) {
    return {
      ok: [],
      error: `You can select at most ${MAX_RESUME_FILES} files.`,
    };
  }
  return { ok: next, error: null };
}

export function MultiUploadZone({
  files,
  onFilesChange,
  loading = false,
}: MultiUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const applyList = useCallback(
    (list: File[]) => {
      const { ok, error } = validateFiles(list);
      if (error) {
        onFilesChange(files, error);
        return;
      }
      onFilesChange(ok, null);
    },
    [files, onFilesChange],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    applyList(dedupeFiles([...files, ...picked]));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    const picked = Array.from(e.dataTransfer.files ?? []);
    if (!picked.length) return;
    applyList(dedupeFiles([...files, ...picked]));
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeAt = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    onFilesChange(next, null);
  };

  const clear = () => onFilesChange([], null);

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
        className="group relative w-full rounded-xl border-2 border-dashed border-navy-500/50 bg-white/5 px-6 py-10 text-center transition-colors hover:border-accent/60 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 disabled:cursor-not-allowed disabled:opacity-60 min-h-[160px] flex flex-col items-center justify-center"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
          aria-hidden
        />
        <div className="pointer-events-none flex flex-col items-center gap-2">
          <span className="rounded-full bg-accent/15 p-3 text-accent">
            <svg
              className="h-7 w-7"
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
          <p className="text-sm font-medium text-slate-200">
            Drop up to {MAX_RESUME_FILES} resumes, or{" "}
            <span className="text-accent underline decoration-accent/50 underline-offset-2 group-hover:decoration-accent">
              browse
            </span>
          </p>
          <p className="text-xs text-slate-500">
            PDF or Word (.docx) · max 5MB each
          </p>
        </div>
      </button>

      {files.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}-${f.size}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-navy-900/40 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-slate-200">
                {f.name}{" "}
                <span className="text-slate-500">· {formatBytes(f.size)}</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeAt(i)}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={clear}
          className="mt-2 text-xs font-medium text-slate-500 underline decoration-slate-600 underline-offset-2 hover:text-slate-400"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
