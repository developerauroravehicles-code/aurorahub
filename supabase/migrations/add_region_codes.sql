-- Add region_codes table
CREATE TABLE IF NOT EXISTS region_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add region_code_id column to dealers table if it doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dealers') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'dealers' 
      AND column_name = 'region_code_id'
    ) THEN
      ALTER TABLE dealers ADD COLUMN region_code_id uuid REFERENCES region_codes(id);
    END IF;
  END IF;
END $$;

-- Enable RLS on region_codes
ALTER TABLE region_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Region codes are viewable by everyone" ON region_codes;
DROP POLICY IF EXISTS "Aurora Managers can manage region codes" ON region_codes;

-- Create policies for region_codes
CREATE POLICY "Region codes are viewable by everyone" 
ON region_codes FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Aurora Managers can manage region codes"
ON region_codes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

