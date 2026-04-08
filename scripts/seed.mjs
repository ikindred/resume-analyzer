import "./load-env.mjs";
import { Pool } from "pg";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    throw new Error("DATABASE_URL is not configured");
  }
  return url;
}

async function main() {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  try {
    const jdCount = await pool.query("SELECT COUNT(*)::text AS count FROM job_descriptions");
    if (Number(jdCount.rows[0]?.count ?? "0") > 0) {
      console.log("Seed skipped (job_descriptions not empty).");
      return;
    }

    const jdText = `Example Job Description\n\nWe are hiring a Frontend Engineer.\nRequirements: React, TypeScript, and 3+ years experience.\nNice to have: Next.js, Tailwind CSS.\n`;

    const criteria = {
      mustHaveSkills: ["React", "TypeScript"],
      niceToHaveSkills: ["Next.js", "Tailwind CSS"],
      softSkills: ["Communication"],
      personalityTraits: [],
      achievements: [],
      schools: [],
      minAge: null,
      maxAge: null,
      minYearsExperience: 3,
      maxGapMonthsAfterCompany: null,
      maxGapMonthsAfterGraduation: null,
      maxCompanies: null,
      notes: "Seed example criteria.",
    };

    const jd = await pool.query(
      "INSERT INTO job_descriptions (title, jd_text, criteria) VALUES ($1, $2, $3) RETURNING id",
      ["Frontend Engineer (Seed)", jdText, criteria],
    );

    await pool.query(
      "INSERT INTO saved_candidates (job_description_id, file_name, rank, rank_score, analysis) VALUES ($1, $2, $3, $4, $5)",
      [
        jd.rows[0].id,
        "seed-resume.pdf",
        1,
        92.5,
        {
          candidateName: "Seed Candidate",
          contactInfo: { email: "", phone: "", location: "" },
          summary: "Seed analysis row.",
          skills: ["React", "TypeScript"],
          experience: [],
          education: [],
          certificates: [],
          trainings: [],
          criteriaRatings: [],
          goodThings: ["Seed good thing"],
          badThings: ["Seed bad thing"],
          assessment: {
            strengths: "Seed strengths",
            concerns: "Seed concerns",
            fitScore: 8,
            justification: "Seed justification",
          },
          recommendation: "Consider for Interview",
        },
      ],
    );

    console.log("Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

