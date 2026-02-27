-- Allow Aurora Managers to read demand_logs (audit trail)
-- Without this policy, RLS blocks all SELECT (table has RLS enabled but no policies)
CREATE POLICY "Aurora Managers can view demand logs"
ON demand_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);
