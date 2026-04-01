/** HR screening criteria (session-only on client; sent as JSON in FormData). */

export interface HrCriteria {
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  softSkills: string[];
  personalityTraits: string[];
  achievements: string[];
  schools: string[];
  minAge: number | null;
  maxAge: number | null;
  minYearsExperience: number | null;
  maxGapMonthsAfterCompany: number | null;
  maxGapMonthsAfterGraduation: number | null;
  maxCompanies: number | null;
  notes: string;
}

export const EMPTY_HR_CRITERIA: HrCriteria = {
  mustHaveSkills: [],
  niceToHaveSkills: [],
  softSkills: [],
  personalityTraits: [],
  achievements: [],
  schools: [],
  minAge: null,
  maxAge: null,
  minYearsExperience: null,
  maxGapMonthsAfterCompany: null,
  maxGapMonthsAfterGraduation: null,
  maxCompanies: null,
  notes: "",
};

/** Split textarea / comma-separated input into trimmed non-empty strings. */
export function linesToList(s: string): string[] {
  return s
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseHrCriteriaJson(raw: string | null | undefined): HrCriteria {
  if (!raw?.trim()) return EMPTY_HR_CRITERIA;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return EMPTY_HR_CRITERIA;
    const o = v as Record<string, unknown>;
    const num = (x: unknown): number | null =>
      typeof x === "number" && Number.isFinite(x) ? x : null;
    const strArr = (x: unknown): string[] =>
      Array.isArray(x) && x.every((i) => typeof i === "string")
        ? (x as string[])
        : [];
    return {
      mustHaveSkills: strArr(o.mustHaveSkills),
      niceToHaveSkills: strArr(o.niceToHaveSkills),
      softSkills: strArr(o.softSkills),
      personalityTraits: strArr(o.personalityTraits),
      achievements: strArr(o.achievements),
      schools: strArr(o.schools),
      minAge: num(o.minAge),
      maxAge: num(o.maxAge),
      minYearsExperience: num(o.minYearsExperience),
      maxGapMonthsAfterCompany: num(o.maxGapMonthsAfterCompany),
      maxGapMonthsAfterGraduation: num(o.maxGapMonthsAfterGraduation),
      maxCompanies: num(o.maxCompanies),
      notes: typeof o.notes === "string" ? o.notes : "",
    };
  } catch {
    return EMPTY_HR_CRITERIA;
  }
}
