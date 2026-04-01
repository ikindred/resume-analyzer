import type { ResumeAnalysis } from "@/lib/analyzeResume";
import type { HrCriteria } from "@/lib/hrCriteria";

export type RankedCandidate = {
  rank: number;
  fileName: string;
  rankScore: number;
  analysis: ResumeAnalysis;
};

export type RankApiResponse = {
  criteria: HrCriteria;
  candidates: RankedCandidate[];
  failed: Array<{ fileName: string; error?: string }>;
};
