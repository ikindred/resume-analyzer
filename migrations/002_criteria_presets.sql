CREATE TABLE IF NOT EXISTS criteria_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  criteria jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS criteria_presets_name_unique
  ON criteria_presets (name);

