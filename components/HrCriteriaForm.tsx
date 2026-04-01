"use client";

import type { HrCriteria } from "@/lib/hrCriteria";
import { linesToList } from "@/lib/hrCriteria";

type Props = {
  value: HrCriteria;
  onChange: (next: HrCriteria) => void;
  disabled?: boolean;
};

function ListField({
  label,
  hint,
  text,
  onTextChange,
  disabled,
}: {
  label: string;
  hint: string;
  text: string;
  onTextChange: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        disabled={disabled}
        rows={3}
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
        placeholder="One per line (or comma-separated)"
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
  min,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        disabled={disabled}
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
      />
    </div>
  );
}

export function HrCriteriaForm({ value, onChange, disabled }: Props) {
  const setList = (key: keyof HrCriteria, raw: string) => {
    onChange({ ...value, [key]: linesToList(raw) } as HrCriteria);
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">
        HR screening criteria
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Used by the AI for criteria ratings, interview decision, and ranking.
        Clears when you refresh the page.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <ListField
          label="Must-have skills"
          hint="Required technical or domain skills."
          text={value.mustHaveSkills.join("\n")}
          onTextChange={(s) => setList("mustHaveSkills", s)}
          disabled={disabled}
        />
        <ListField
          label="Nice-to-have skills"
          hint="Bonus skills."
          text={value.niceToHaveSkills.join("\n")}
          onTextChange={(s) => setList("niceToHaveSkills", s)}
          disabled={disabled}
        />
        <ListField
          label="Soft skills"
          hint="e.g. communication, leadership."
          text={value.softSkills.join("\n")}
          onTextChange={(s) => setList("softSkills", s)}
          disabled={disabled}
        />
        <ListField
          label="Personality / culture"
          hint="Traits or values to look for."
          text={value.personalityTraits.join("\n")}
          onTextChange={(s) => setList("personalityTraits", s)}
          disabled={disabled}
        />
        <ListField
          label="Achievements"
          hint="Types of impact or awards you want to see."
          text={value.achievements.join("\n")}
          onTextChange={(s) => setList("achievements", s)}
          disabled={disabled}
        />
        <ListField
          label="Schools / programs"
          hint="Preferred universities or bootcamps (partial names ok)."
          text={value.schools.join("\n")}
          onTextChange={(s) => setList("schools", s)}
          disabled={disabled}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumField
          label="Min age"
          value={value.minAge}
          onChange={(n) => onChange({ ...value, minAge: n })}
          disabled={disabled}
          min={16}
        />
        <NumField
          label="Max age"
          value={value.maxAge}
          onChange={(n) => onChange({ ...value, maxAge: n })}
          disabled={disabled}
          min={16}
        />
        <NumField
          label="Min years experience"
          value={value.minYearsExperience}
          onChange={(n) => onChange({ ...value, minYearsExperience: n })}
          disabled={disabled}
          min={0}
        />
        <NumField
          label="Max companies (recent roles)"
          value={value.maxCompanies}
          onChange={(n) => onChange({ ...value, maxCompanies: n })}
          disabled={disabled}
          min={0}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumField
          label="Max gap (months) after a company"
          value={value.maxGapMonthsAfterCompany}
          onChange={(n) => onChange({ ...value, maxGapMonthsAfterCompany: n })}
          disabled={disabled}
          min={0}
        />
        <NumField
          label="Max gap (months) after graduation"
          value={value.maxGapMonthsAfterGraduation}
          onChange={(n) =>
            onChange({ ...value, maxGapMonthsAfterGraduation: n })
          }
          disabled={disabled}
          min={0}
        />
      </div>

      <div className="mt-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Other notes for the AI
        </label>
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          disabled={disabled}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-navy-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
          placeholder="Dealbreakers, seniority, location, salary band context…"
        />
      </div>
    </section>
  );
}
