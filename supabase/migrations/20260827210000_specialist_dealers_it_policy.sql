-- Allow IT role to manage specialist-dealer assignments (matches scheduling pool managers).

DROP POLICY IF EXISTS "Aurora Managers can manage specialist-dealer assignments" ON specialist_dealers;

CREATE POLICY "Calendar managers can manage specialist-dealer assignments"
  ON specialist_dealers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('aurora_manager', 'it')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('aurora_manager', 'it')
    )
  );
