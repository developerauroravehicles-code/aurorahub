-- Allow Aurora Manager to create demands (external demands from admin)
-- Aurora Manager creates external demands via Create External Demand form

DROP POLICY IF EXISTS "Sales and Finance can create demands" ON demands;

CREATE POLICY "Sales, Finance and Aurora Manager can create demands"
ON demands FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('sales', 'finance', 'aurora_manager')
  )
);
