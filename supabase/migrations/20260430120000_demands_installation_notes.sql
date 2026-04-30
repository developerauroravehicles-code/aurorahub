-- Post-install observations on demands (replacements, behaviour, etc.) — Aurora Manager only, multiple rows per demand.

CREATE TABLE IF NOT EXISTS demand_installation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demand_installation_notes_body_not_blank CHECK (length(trim(body)) > 0)
);

COMMENT ON TABLE demand_installation_notes IS 'Aurora Manager notes after installation; multiple entries per demand.';

CREATE INDEX IF NOT EXISTS idx_demand_installation_notes_demand_id ON demand_installation_notes(demand_id);
CREATE INDEX IF NOT EXISTS idx_demand_installation_notes_demand_created ON demand_installation_notes(demand_id, created_at DESC);

ALTER TABLE demand_installation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aurora managers can select demand installation notes"
  ON demand_installation_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager'
    )
  );

CREATE POLICY "Aurora managers can insert demand installation notes"
  ON demand_installation_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager'
    )
    AND author_id = auth.uid()
  );

CREATE POLICY "Aurora managers can delete demand installation notes"
  ON demand_installation_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager'
    )
  );
