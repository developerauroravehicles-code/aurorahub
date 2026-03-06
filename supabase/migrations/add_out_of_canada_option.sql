-- Add "Out Of Canada" option for Province and Region

-- Add to canadian_province enum (used by personnel.province)
DO $$ BEGIN
  ALTER TYPE canadian_province ADD VALUE 'out_of_canada';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insert "Out Of Canada" region (used by personnel.region_id)
INSERT INTO hr_regions (name, code)
VALUES ('Out Of Canada', 'out_of_canada')
ON CONFLICT (code) DO NOTHING;
