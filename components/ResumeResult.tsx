import type { ResumeAnalysis } from "@/lib/analyzeResume";

function recommendationStyles(
  r: ResumeAnalysis["recommendation"],
): { label: string; className: string } {
  switch (r) {
    case "Strong Candidate":
      return {
        label: r,
        className:
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30",
      };
    case "Consider for Interview":
      return {
        label: r,
        className:
          "border-amber-500/40 bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30",
      };
    case "Not a Match":
    default:
      return {
        label: r,
        className:
          "border-rose-500/35 bg-rose-500/10 text-rose-100 ring-1 ring-rose-500/25",
      };
  }
}

export function ResumeResult({ data }: { data: ResumeAnalysis }) {
  const badge = recommendationStyles(data.recommendation);

  return (
    <article className="space-y-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur-sm transition-opacity duration-300 md:p-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">
            Candidate overview
          </h2>
          <p className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
            {data.candidateName || "Candidate"}
          </p>
        </div>
        <span
          className={`inline-flex w-fit shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </header>

      <section aria-labelledby="overview-heading">
        <h3 id="overview-heading" className="sr-only">
          Contact details
        </h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-200">
              {data.contactInfo.email || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd className="font-medium text-slate-200">
              {data.contactInfo.phone || "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Location</dt>
            <dd className="font-medium text-slate-200">
              {data.contactInfo.location || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="summary-heading">
        <h3
          id="summary-heading"
          className="text-sm font-semibold uppercase tracking-wider text-accent"
        >
          Professional summary
        </h3>
        <p className="mt-2 leading-relaxed text-slate-300">{data.summary}</p>
      </section>

      <section aria-labelledby="skills-heading">
        <h3
          id="skills-heading"
          className="text-sm font-semibold uppercase tracking-wider text-accent"
        >
          Key skills
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(data.skills?.length ? data.skills : ["—"]).map((skill, i) => (
            <li
              key={`${skill}-${i}`}
              className="rounded-full border border-white/10 bg-navy-800/80 px-3 py-1 text-sm text-slate-200"
            >
              {skill}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="experience-heading">
        <h3
          id="experience-heading"
          className="text-sm font-semibold uppercase tracking-wider text-accent"
        >
          Work experience
        </h3>
        <ul className="mt-4 space-y-6">
          {(data.experience?.length ? data.experience : []).map((job, i) => (
            <li
              key={`${job.company}-${job.title}-${i}`}
              className="border-l-2 border-accent/40 pl-4"
            >
              <p className="font-semibold text-white">{job.title}</p>
              <p className="text-sm text-slate-400">
                {job.company}
                {job.duration ? ` · ${job.duration}` : ""}
              </p>
              {job.highlights?.length ? (
                <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
                  {job.highlights.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="education-heading">
        <h3
          id="education-heading"
          className="text-sm font-semibold uppercase tracking-wider text-accent"
        >
          Education
        </h3>
        <ul className="mt-4 space-y-3">
          {(data.education?.length ? data.education : []).map((edu, i) => (
            <li key={`${edu.school}-${i}`} className="text-slate-300">
              <span className="font-medium text-slate-100">{edu.degree}</span>
              {edu.school ? (
                <>
                  {" "}
                  <span className="text-slate-500">·</span> {edu.school}
                </>
              ) : null}
              {edu.year ? (
                <span className="text-slate-500"> · {edu.year}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="assessment-heading"
        className="rounded-xl border border-white/10 bg-navy-900/50 p-5"
      >
        <h3
          id="assessment-heading"
          className="text-sm font-semibold uppercase tracking-wider text-accent"
        >
          AI assessment
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-medium uppercase text-slate-500">
              Strengths
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {data.assessment.strengths}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-medium uppercase text-slate-500">
              Concerns
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {data.assessment.concerns}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-2 border-t border-white/10 pt-4">
          <span className="text-3xl font-bold text-white tabular-nums">
            {data.assessment.fitScore}
          </span>
          <span className="text-sm text-slate-500">/ 10 fit score</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {data.assessment.justification}
        </p>
      </section>
    </article>
  );
}
