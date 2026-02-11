-- PMF (Product-Market Fit) survey columns
-- Adds Superhuman/Sean Ellis methodology fields to survey_responses.
-- Existing rating column becomes nullable for backward compatibility.

ALTER TABLE survey_responses
  ALTER COLUMN rating DROP NOT NULL;

ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS disappointment_level TEXT
    CHECK (disappointment_level IN ('very_disappointed', 'somewhat_disappointed', 'not_disappointed')),
  ADD COLUMN IF NOT EXISTS target_user TEXT,
  ADD COLUMN IF NOT EXISTS main_benefit TEXT,
  ADD COLUMN IF NOT EXISTS improvement TEXT;
