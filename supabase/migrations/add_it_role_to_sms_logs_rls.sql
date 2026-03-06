-- Allow IT role to view sms_logs (RLS previously only allowed aurora_manager)
DROP POLICY IF EXISTS "Aurora Managers can view sms_logs" ON sms_logs;
CREATE POLICY "Aurora Managers and IT can view sms_logs"
  ON sms_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('aurora_manager', 'it')
    )
  );
