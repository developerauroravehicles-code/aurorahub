-- Leave requests: Aurora Manager approves (HR creates, AM approves)
-- Update RLS so HR and Aurora Manager can manage leave_requests

DROP POLICY IF EXISTS "HR can manage leave_requests" ON leave_requests;

CREATE POLICY "hr_aurora_manager_manage_leave_requests"
  ON leave_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('hr', 'aurora_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('hr', 'aurora_manager')
    )
  );
