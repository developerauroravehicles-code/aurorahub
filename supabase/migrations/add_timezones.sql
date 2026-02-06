-- Add timezones table and timezone support to region_codes
-- This migration adds timezone management to the system

-- 1. Create timezones table
CREATE TABLE IF NOT EXISTS timezones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, -- e.g., "America/Vancouver", "America/Toronto"
  display_name text NOT NULL, -- e.g., "Pacific Time (PT)", "Eastern Time (ET)"
  utc_offset text NOT NULL, -- e.g., "-08:00", "-05:00"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Add timezone_id column to region_codes table
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'region_codes') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'region_codes' 
      AND column_name = 'timezone_id'
    ) THEN
      ALTER TABLE region_codes ADD COLUMN timezone_id uuid REFERENCES timezones(id);
    END IF;
  END IF;
END $$;

-- 3. Insert common Canadian timezones
INSERT INTO timezones (name, display_name, utc_offset) VALUES
  ('America/Vancouver', 'Pacific Time (PT)', '-08:00'),
  ('America/Edmonton', 'Mountain Time (MT)', '-07:00'),
  ('America/Winnipeg', 'Central Time (CT)', '-06:00'),
  ('America/Toronto', 'Eastern Time (ET)', '-05:00'),
  ('America/Halifax', 'Atlantic Time (AT)', '-04:00'),
  ('America/St_Johns', 'Newfoundland Time (NT)', '-03:30')
ON CONFLICT (name) DO NOTHING;

-- 4. Enable RLS on timezones
ALTER TABLE timezones ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for timezones
DROP POLICY IF EXISTS "Timezones are viewable by everyone" ON timezones;
CREATE POLICY "Timezones are viewable by everyone"
  ON timezones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Aurora Managers can manage timezones" ON timezones;
CREATE POLICY "Aurora Managers can manage timezones"
  ON timezones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  );

-- 6. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_region_codes_timezone_id ON region_codes(timezone_id);
CREATE INDEX IF NOT EXISTS idx_timezones_name ON timezones(name);

