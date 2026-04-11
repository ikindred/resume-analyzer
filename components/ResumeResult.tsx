import type { ReactNode } from "react";
import type { Recommendation, ResumeAnalysis } from "@/lib/analyzeResume";
import {
  getJobResponsibilityRenderModel,
  safeCertificateArray,
} from "@/lib/analyzeResume";
import type { HrCriteria } from "@/lib/hrCriteria";
import { InterviewQuestions } from "@/components/InterviewQuestions";

function recommendationBadgeClass(
  r: Recommendation,
): { label: string; className: string } {
  switch (r) {
    case "Strong Candidate":
      return {
        label: r,
        className:
          "border-emerald-600/30 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/20 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-500/25",
      };
    case "Consider for Interview":
      return {
        label: r,
        className:
          "border-amber-600/30 bg-amber-50 text-amber-950 ring-1 ring-amber-600/20 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/25",
      };
    case "Not a Match":
    default:
      return {
        label: r,
        className:
          "border-rose-600/30 bg-rose-50 text-rose-950 ring-1 ring-rose-600/20 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-500/25",
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

function SectionTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`mt-8 border-b border-slate-300 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-800 first:mt-0 dark:border-slate-600 dark:text-slate-200 ${className}`}
    >
      {children}
    </h2>
  );
}

export function ResumeResult({
  data,
  criteria,
}: {
  data: ResumeAnalysis;
  criteria?: HrCriteria;
}) {
  const badge = recommendationBadgeClass(data.recommendation);
  const verdict = interviewVerdict(data.recommendation);
  const skills = data.skills?.filter((s) => s.trim()) ?? [];
  const certs = safeCertificateArray(data.certificates);
  const trainings = data.trainings?.filter((s) => s.trim()) ?? [];

  const contactParts = [
    data.contactInfo.email,
    data.contactInfo.phone,
    data.contactInfo.location,
  ].filter(Boolean);

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 shadow-xl dark:border-white/10 dark:shadow-2xl leading-[1.5]">
      {/* Template-style document body (matches internal summary PDF layout) */}
      <div className="bg-white px-6 py-8 text-slate-900 dark:bg-slate-950 sm:px-10 sm:py-10 dark:text-slate-100">
        <p className="mb-6 text-xs text-slate-600 dark:text-slate-500">
          The sections below transcribe the uploaded resume (wording preserved).
          Screening and scores in the gray panel are AI-generated from that
          text.
        </p>
        <SectionTitle>Candidate name:</SectionTitle>
        <p className="mt-3 text-xl font-bold uppercase tracking-tight text-slate-950 sm:text-2xl dark:text-white">
          {data.candidateName?.trim() || "Candidate"}
        </p>
        {contactParts.length > 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {contactParts.join(" · ")}
          </p>
        ) : null}

        <section className="mt-6 pb-14 sm:mt-8 sm:pb-16">
          <SectionTitle>Profile (from resume):</SectionTitle>
          <p className="mt-3 whitespace-pre-line text-sm text-slate-800 dark:text-slate-200">
            {data.summary?.trim() || "—"}
          </p>
        </section>

        {data.skillsSections && data.skillsSections.length > 0 ? (
          <div className="space-y-12 sm:space-y-14">
            {data.skillsSections.map((sec, si) => (
              <div key={`${sec.title}-${si}`}>
                <SectionTitle className="border-slate-400/80 pb-2 dark:border-slate-500/80">
                  {sec.title}
                </SectionTitle>
                <ul className="mt-4 list-none space-y-2 text-sm text-slate-800 dark:text-slate-200">
                  {(sec.items?.length ? sec.items : ["—"]).map((skill, i) => (
                    <li key={`${skill}-${i}`} className="flex gap-2">
                      <span
                        className="shrink-0 text-slate-600 dark:text-slate-400"
                        aria-hidden
                      >
                        •
                      </span>
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <>
            <SectionTitle className="border-slate-400/80 pb-2 dark:border-slate-500/80">
              Skills
            </SectionTitle>
          <ul className="mt-4 list-none space-y-2 text-sm text-slate-800 dark:text-slate-200">
            {(skills.length ? skills : ["—"]).map((skill, i) => (
              <li key={`${skill}-${i}`} className="flex gap-2">
                <span
                  className="shrink-0 text-slate-600 dark:text-slate-400"
                  aria-hidden
                >
                  •
                </span>
                <span>{skill}</span>
              </li>
            ))}
          </ul>
          </>
        )}

        <SectionTitle>Professional experience</SectionTitle>
        <ul className="mt-4 list-none space-y-8">
          {(data.experience?.length ? data.experience : []).map((job, i) => {
            const respModel = getJobResponsibilityRenderModel(job);
            const hasResp =
              respModel.mode === "flat"
                ? respModel.items.length > 0
                : respModel.blocks.length > 0;
            const projects =
              job.projectsInclude?.filter((p) => p.trim()) ?? [];
            return (
            <li key={`${job.company}-${job.title}-${i}`}>
              <div className="flex w-full items-baseline justify-between gap-4 text-sm font-bold text-slate-950 dark:text-white">
                <span className="min-w-0 flex-1 uppercase">
                  {job.title}
                </span>
                {job.duration ? (
                  <span className="shrink-0 text-right font-bold normal-case text-slate-800 dark:text-slate-200">
                    {job.duration}
                  </span>
                ) : null}
              </div>
              {job.company ? (
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {job.company}
                </p>
              ) : null}
              {job.location?.trim() ? (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {job.location.trim()}
                </p>
              ) : null}
              {hasResp ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Job responsibilities:
                  </p>
                  {respModel.mode === "flat" ? (
                    <ul className="mt-2 list-none space-y-2 text-sm text-slate-800 dark:text-slate-200">
                      {respModel.items.map((h, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="shrink-0" aria-hidden>
                            ●
                          </span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 space-y-3 text-sm text-slate-800 dark:text-slate-200">
                      {respModel.blocks.map((block, bi) => (
                        <div key={bi}>
                          {block.subtitle.trim() ? (
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {block.subtitle.trim()}
                            </p>
                          ) : null}
                          <ul
                            className={`list-none space-y-2 ${
                              block.subtitle.trim() ? "mt-2 pl-4" : ""
                            }`}
                          >
                            {block.items.map((h, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="shrink-0" aria-hidden>
                                  ●
                                </span>
                                <span>{h}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
              {job.specialistLead?.trim() ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Specialist / Digital Services Lead:
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-800 dark:text-slate-200">
                    {job.specialistLead.trim()}
                  </p>
                </>
              ) : null}
              {projects.length ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Projects include:
                  </p>
                  <ul className="mt-2 list-none space-y-2 text-sm text-slate-800 dark:text-slate-200">
                    {projects.map((p, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="shrink-0" aria-hidden>
                          ●
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </li>
            );
          })}
        </ul>
        {!data.experience?.length ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-500">—</p>
        ) : null}

        {(data.standaloneProjects ?? []).some((p) => p.title?.trim()) ? (
          <>
            <SectionTitle>Projects</SectionTitle>
            <ul className="mt-4 list-none space-y-8">
              {(data.standaloneProjects ?? [])
                .filter((p) => p.title?.trim())
                .map((proj, pi) => (
                  <li key={`${proj.title}-${pi}`}>
                    <div className="flex w-full items-baseline justify-between gap-4 text-sm font-bold text-slate-950 dark:text-white">
                      <span className="min-w-0 flex-1 uppercase">
                        {proj.title.trim()}
                      </span>
                      {proj.duration?.trim() ? (
                        <span className="shrink-0 text-right font-bold normal-case text-slate-800 dark:text-slate-200">
                          {proj.duration.trim()}
                        </span>
                      ) : null}
                    </div>
                    {proj.companyOrContext?.trim() ? (
                      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {proj.companyOrContext.trim()}
                      </p>
                    ) : null}
                    {(proj.bullets ?? []).filter((b) => b.trim()).length ? (
                      <ul className="mt-2 list-none space-y-2 text-sm text-slate-800 dark:text-slate-200">
                        {proj.bullets
                          ?.filter((b) => b.trim())
                          .map((b, j) => (
                            <li key={j} className="flex gap-2">
                              <span className="shrink-0" aria-hidden>
                                ●
                              </span>
                              <span>{b.trim()}</span>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
            </ul>
          </>
        ) : null}

        <SectionTitle>Education / credentials / certificates</SectionTitle>
        <div className="mt-4 space-y-6 text-sm text-slate-800 dark:text-slate-200">
          {(data.education?.length ? data.education : []).map((edu, i) => {
            const degree = edu.degree?.trim();
            const year = edu.year?.trim();
            const school = edu.school?.trim();
            const hasHeader = Boolean(degree || year);
            return (
              <div key={`${school ?? "edu"}-${i}`}>
                {degree && year ? (
                  <div className="flex w-full items-baseline justify-between gap-4 font-bold text-slate-950 dark:text-white">
                    <span className="min-w-0 flex-1 uppercase">{degree}</span>
                    <span className="shrink-0 text-right font-bold normal-case text-slate-800 dark:text-slate-200">
                      {year}
                    </span>
                  </div>
                ) : degree ? (
                  <p className="font-bold uppercase text-slate-950 dark:text-white">
                    {degree}
                  </p>
                ) : year ? (
                  <p className="font-bold normal-case text-slate-950 dark:text-white">
                    {year}
                  </p>
                ) : null}
                {school ? (
                  <p
                    className={`font-medium text-slate-700 dark:text-slate-300 ${
                      hasHeader ? "mt-1" : ""
                    }`}
                  >
                    {school}
                  </p>
                ) : null}
                {!degree && !year && !school ? (
                  <p className="text-slate-600 dark:text-slate-500">—</p>
                ) : null}
              </div>
            );
          })}
          {!data.education?.length ? (
            <p className="text-slate-600 dark:text-slate-500">—</p>
          ) : null}
        </div>

        {certs.length > 0 ? (
          <>
            <SectionTitle>Certificates</SectionTitle>
            <div className="mt-4 space-y-8 text-sm text-slate-800 dark:text-slate-200">
              {certs.map((c, i) => (
                <div key={`${c.name}-${i}`}>
                  <p className="font-bold uppercase text-slate-950 dark:text-white">
                    {c.name}
                  </p>
                  {c.datedItems?.length ? (
                    <div className="mt-3 space-y-4">
                      {c.datedItems.map((g, gi) => (
                        <div key={`${g.period}-${gi}`}>
                          {g.period?.trim() ? (
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {g.period.trim()}
                            </p>
                          ) : null}
                          <ul className="mt-2 list-none space-y-2 pl-3 sm:pl-4">
                            {(g.items ?? [])
                              .filter((line) => line.trim())
                              .map((line, li) => (
                                <li key={li} className="flex gap-2">
                                  <span className="shrink-0" aria-hidden>
                                    ●
                                  </span>
                                  <span>{line.trim()}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {trainings.length > 0 ? (
          <>
            <SectionTitle>Trainings</SectionTitle>
            <ul className="mt-4 list-none space-y-2 text-sm text-slate-800 dark:text-slate-200">
              {trainings.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className="shrink-0 text-slate-600 dark:text-slate-400"
                    aria-hidden
                  >
                    •
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {/* AI analysis + interview decision */}
      <div className="border-t border-slate-200 bg-slate-100 px-6 py-8 dark:border-slate-700 dark:bg-slate-900/90 sm:px-10">
        <h2 className="border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-800 dark:border-slate-600 dark:text-slate-100">
          AI recruiter analysis
        </h2>

        {(data.criteriaRatings?.length ?? 0) > 0 ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              HR criteria ratings
            </h3>
            <ul className="mt-2 space-y-3 text-sm">
              {data.criteriaRatings.map((cr, i) => (
                <li
                  key={`${cr.criterion}-${i}`}
                  className="border-b border-slate-200/80 pb-3 last:border-0 last:pb-0 dark:border-slate-600/80"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {cr.criterion}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      {cr.rating}/5
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {cr.evidence}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Good signals
            </h3>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-800 dark:text-slate-200">
              {(data.goodThings?.length ? data.goodThings : ["—"]).map(
                (g, i) => (
                  <li key={i}>{g}</li>
                ),
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Risks / gaps
            </h3>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-800 dark:text-slate-200">
              {(data.badThings?.length ? data.badThings : ["—"]).map(
                (b, i) => (
                  <li key={i}>{b}</li>
                ),
              )}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200/80 pt-6 dark:border-slate-600/80 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Interview
            </p>
            <p
              className={`mt-1 text-lg font-bold ${verdict.forInterview ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}`}
            >
              {verdict.forInterview ? "Yes" : "No"}
            </p>
            <p className="mt-1 max-w-xl text-sm text-slate-700 dark:text-slate-300">
              {verdict.line}
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="mt-6 grid gap-5 border-t border-slate-200/80 pt-6 dark:border-slate-600/80 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Strengths
            </h3>
            <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200">
              {data.assessment.strengths}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Concerns
            </h3>
            <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200">
              {data.assessment.concerns}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-baseline gap-2 border-t border-slate-200/80 pt-6 dark:border-slate-600/80">
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {data.assessment.fitScore}
          </span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            / 10 role fit score
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          {data.assessment.justification}
        </p>
      </div>

      {criteria ? (
        <div className="border-t border-slate-200 bg-slate-100 px-6 py-8 dark:border-slate-700 dark:bg-slate-900/90 sm:px-10">
          <InterviewQuestions analysis={data} criteria={criteria} />
        </div>
      ) : null}
    </article>
  );
}
