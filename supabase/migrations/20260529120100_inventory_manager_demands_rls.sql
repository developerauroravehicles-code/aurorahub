-- Scope demand UPDATE access for inventory_manager to own dealer only.
-- Runs in a separate migration after inventory_manager enum value is committed.

DROP POLICY IF EXISTS "Finance and Managers can update demands" ON demands;

CREATE POLICY "Finance and Managers can update demands"
ON demands FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role IN ('finance', 'aurora_manager', 'general_manager')
      OR (
        p.role = 'inventory_manager'
        AND demands.dealer_id = p.dealer_id
        AND p.dealer_id IS NOT NULL
      )
    )
  )
);
