import type { ReactNode } from "react";
import type { Recommendation, ResumeAnalysis } from "@/lib/analyzeResume";

function recommendationBadgeClass(
  r: Recommendation,
): { label: string; className: string } {
  switch (r) {
    case "Strong Candidate":
      return {
        label: r,
        className:
          "border-emerald-600/30 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/20",
      };
    case "Consider for Interview":
      return {
        label: r,
        className:
          "border-amber-600/30 bg-amber-50 text-amber-950 ring-1 ring-amber-600/20",
      };
    case "Not a Match":
    default:
      return {
        label: r,
        className:
          "border-rose-600/30 bg-rose-50 text-rose-950 ring-1 ring-rose-600/20",
      };
  }
}

function interviewVerdict(r: Recommendation): {
  forInterview: boolean;
  line: string;
} {
  switch (r) {
    case "Strong Candidate":
      return {
        forInterview: true,
        line: "Yes — strong fit; recommended to move forward to interview.",
      };
    case "Consider for Interview":
      return {
        forInterview: true,
        line: "Yes — schedule an interview to validate fit and address open questions.",
      };
    case "Not a Match":
    default:
      return {
        forInterview: false,
        line: "No — not recommended for interview based on current role fit.",
      };
  }
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 border-b border-slate-300 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-800 first:mt-0">
      {children}
    </h2>
  );
}

export function ResumeResult({ data }: { data: ResumeAnalysis }) {
  const badge = recommendationBadgeClass(data.recommendation);
  const verdict = interviewVerdict(data.recommendation);
  const skills = data.skills?.filter((s) => s.trim()) ?? [];
  const certs = data.certificates?.filter((s) => s.trim()) ?? [];
  const trainings = data.trainings?.filter((s) => s.trim()) ?? [];

  const contactParts = [
    data.contactInfo.email,
    data.contactInfo.phone,
    data.contactInfo.location,
  ].filter(Boolean);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 shadow-2xl">
      {/* Template-style document body (matches internal summary PDF layout) */}
      <div className="bg-white px-6 py-8 text-slate-900 sm:px-10 sm:py-10">
        <SectionTitle>Candidate name:</SectionTitle>
        <p className="mt-3 text-xl font-bold uppercase tracking-tight text-slate-950 sm:text-2xl">
          {data.candidateName?.trim() || "Candidate"}
        </p>
        {contactParts.length > 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {contactParts.join(" · ")}
          </p>
        ) : null}

        <SectionTitle>Profile:</SectionTitle>
        <p className="mt-3 text-sm leading-relaxed text-slate-800">
          {data.summary?.trim() || "—"}
        </p>

        <SectionTitle>Skills:</SectionTitle>
        <ul className="mt-3 list-none space-y-1.5 text-sm leading-snug text-slate-800">
          {(skills.length ? skills : ["—"]).map((skill, i) => (
            <li key={`${skill}-${i}`} className="flex gap-2">
              <span className="shrink-0 text-slate-600" aria-hidden>
                •
              </span>
              <span>{skill}</span>
            </li>
          ))}
        </ul>

        <SectionTitle>Professional experience</SectionTitle>
        <ul className="mt-4 list-none space-y-8">
          {(data.experience?.length ? data.experience : []).map((job, i) => (
            <li key={`${job.company}-${job.title}-${i}`}>
              <p className="text-sm font-bold uppercase leading-snug text-slate-950">
                {job.title}
                {job.duration ? (
                  <span className="font-bold normal-case text-slate-800">
                    {" "}
                    {job.duration}
                  </span>
                ) : null}
              </p>
              {job.company ? (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {job.company}
                </p>
              ) : null}
              {job.highlights?.length ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    Job responsibilities:
                  </p>
                  <ul className="mt-2 list-none space-y-1.5 text-sm leading-snug text-slate-800">
                    {job.highlights.map((h, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="shrink-0" aria-hidden>
                          ●
                        </span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {!data.experience?.length ? (
          <p className="mt-3 text-sm text-slate-600">—</p>
        ) : null}

        <SectionTitle>Education / credentials / certificates</SectionTitle>
        <div className="mt-4 space-y-6 text-sm text-slate-800">
          {(data.education?.length ? data.education : []).map((edu, i) => (
            <div key={`${edu.school}-${i}`}>
              <p className="font-bold uppercase leading-snug text-slate-950">
                {edu.degree || "—"}
              </p>
              <p className="mt-1 leading-relaxed text-slate-700">
                {[edu.school, edu.year].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          ))}
          {!data.education?.length ? (
            <p className="text-slate-600">—</p>
          ) : null}

          {certs.length > 0 ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Certificates
                </p>
                <ul className="mt-2 list-none space-y-1.5 leading-snug">
                  {certs.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0" aria-hidden>
                        ●
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          {trainings.length > 0 ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-800">
                Trainings
              </p>
              <ul className="mt-2 list-none space-y-1.5 leading-snug">
                {trainings.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-slate-600" aria-hidden>
                      •
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* AI analysis + interview decision */}
      <div className="border-t border-slate-200 bg-slate-100 px-6 py-8 sm:px-10">
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-800">
          AI recruiter analysis
        </h2>

        {(data.criteriaRatings?.length ?? 0) > 0 ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase text-slate-600">
              HR criteria ratings
            </h3>
            <ul className="mt-2 space-y-3 text-sm">
              {data.criteriaRatings.map((cr, i) => (
                <li
                  key={`${cr.criterion}-${i}`}
                  className="border-b border-slate-200/80 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {cr.criterion}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                      {cr.rating}/5
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {cr.evidence}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600">
              Good signals
            </h3>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-800">
              {(data.goodThings?.length ? data.goodThings : ["—"]).map(
                (g, i) => (
                  <li key={i}>{g}</li>
                ),
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600">
              Risks / gaps
            </h3>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-800">
              {(data.badThings?.length ? data.badThings : ["—"]).map(
                (b, i) => (
                  <li key={i}>{b}</li>
                ),
              )}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200/80 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Interview
            </p>
            <p
              className={`mt-1 text-lg font-bold ${verdict.forInterview ? "text-emerald-800" : "text-rose-800"}`}
            >
              {verdict.forInterview ? "Yes" : "No"}
            </p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-700">
              {verdict.line}
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="mt-6 grid gap-5 border-t border-slate-200/80 pt-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600">
              Strengths
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
              {data.assessment.strengths}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600">
              Concerns
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
              {data.assessment.concerns}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-2 border-t border-slate-200/80 pt-6">
          <span className="text-3xl font-bold tabular-nums text-slate-900">
            {data.assessment.fitScore}
          </span>
          <span className="text-sm text-slate-600">/ 10 role fit score</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {data.assessment.justification}
        </p>
      </div>
    </article>
  );
}
