-- ============================================
-- FIX: Dealer Region Assignment
-- ============================================
-- This migration fixes the issue where dealers cannot be assigned region codes
-- Issues fixed:
-- 1. Missing UPDATE policy for dealers table (Aurora Managers)
-- 2. Missing region_code_id column in dealers table (if not already added)
-- 3. Missing region_codes table (if not already added)
-- ============================================

-- 1. Ensure region_codes table exists
CREATE TABLE IF NOT EXISTS region_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Add region_code_id column to dealers table if it doesn't exist
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

-- 3. Enable RLS on region_codes if not already enabled
ALTER TABLE region_codes ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Region codes are viewable by everyone" ON region_codes;
DROP POLICY IF EXISTS "Aurora Managers can manage region codes" ON region_codes;
DROP POLICY IF EXISTS "Aurora Managers can manage dealers" ON dealers;

-- 5. Create policies for region_codes
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

-- 6. Create UPDATE policy for dealers table (CRITICAL - This was missing!)
CREATE POLICY "Aurora Managers can manage dealers"
ON dealers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

-- Success message
SELECT '✅ Dealer region assignment fixed! Aurora Managers can now assign region codes to dealers.' as status;

