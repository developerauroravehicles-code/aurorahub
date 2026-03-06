-- Allow IT role to view mail_logs (RLS previously only allowed aurora_manager)
DROP POLICY IF EXISTS "Aurora Managers can view mail logs" ON mail_logs;
CREATE POLICY "Aurora Managers and IT can view mail logs"
  ON mail_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('aurora_manager', 'it')
    )
  );
