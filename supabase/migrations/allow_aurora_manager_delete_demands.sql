-- Allow Aurora Manager to permanently delete demands (appointments)

CREATE POLICY "Aurora Managers can delete demands"
ON demands FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'aurora_manager'
  )
);
