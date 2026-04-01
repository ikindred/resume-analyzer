CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  jd_text text NOT NULL,
  criteria jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_description_id uuid REFERENCES job_descriptions(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  rank integer,
  rank_score double precision,
  analysis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

