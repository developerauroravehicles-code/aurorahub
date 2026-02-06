-- Create junction table for specialist-dealer many-to-many relationship
CREATE TABLE IF NOT EXISTS specialist_dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(specialist_id, dealer_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_specialist_dealers_specialist_id ON specialist_dealers(specialist_id);
CREATE INDEX IF NOT EXISTS idx_specialist_dealers_dealer_id ON specialist_dealers(dealer_id);

-- RLS Policies
ALTER TABLE specialist_dealers ENABLE ROW LEVEL SECURITY;

-- Everyone can view specialist-dealer assignments
CREATE POLICY "Anyone can view specialist-dealer assignments"
  ON specialist_dealers
  FOR SELECT
  USING (true);

-- Only Aurora Managers can manage specialist-dealer assignments
CREATE POLICY "Aurora Managers can manage specialist-dealer assignments"
  ON specialist_dealers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  );

