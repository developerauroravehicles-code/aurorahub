-- Allow Finance role to create demands (same as Sales)
-- Finance-created demands are auto-assigned (assigned_finance_id) in the application layer

DROP POLICY IF EXISTS "Sales can create demands" ON demands;

CREATE POLICY "Sales and Finance can create demands"
ON demands FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('sales', 'finance')
  )
);
