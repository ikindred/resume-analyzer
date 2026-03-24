export function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-lg backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="Analyzing resume"
    >
      <span className="sr-only">Analyzing resume, please wait</span>
      <div className="h-6 w-1/3 rounded bg-slate-600/50" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-600/40" />
        <div className="h-4 w-5/6 rounded bg-slate-600/40" />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <div className="h-7 w-20 rounded-full bg-slate-600/40" />
        <div className="h-7 w-24 rounded-full bg-slate-600/40" />
        <div className="h-7 w-16 rounded-full bg-slate-600/40" />
      </div>
      <div className="space-y-3 pt-4">
        <div className="h-4 w-full rounded bg-slate-600/35" />
        <div className="h-4 w-full rounded bg-slate-600/35" />
        <div className="h-4 w-4/5 rounded bg-slate-600/35" />
      </div>
      <div className="grid gap-3 pt-2 sm:grid-cols-2">
        <div className="h-24 rounded-lg bg-slate-600/30" />
        <div className="h-24 rounded-lg bg-slate-600/30" />
      </div>
    </div>
  );
}
