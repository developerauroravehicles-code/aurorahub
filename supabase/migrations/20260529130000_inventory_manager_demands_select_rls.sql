-- Ensure dealer-scoped roles (including inventory_manager) only SELECT their own dealer's demands.
-- Platform roles (finance, specialist, aurora_manager, general_manager) retain broader access.

DROP POLICY IF EXISTS "Users can view demands from their dealer" ON demands;

CREATE POLICY "Users can view demands from their dealer"
ON demands FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role IN ('finance', 'specialist', 'aurora_manager', 'general_manager')
      OR (
        p.dealer_id IS NOT NULL
        AND demands.dealer_id = p.dealer_id
      )
    )
  )
);
