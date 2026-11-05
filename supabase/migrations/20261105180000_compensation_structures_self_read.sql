-- Allow employees to read their own payroll compensation structure (Self Portal pay estimates).

DROP POLICY IF EXISTS compensation_structures_self_read ON public.compensation_structures;
CREATE POLICY compensation_structures_self_read ON public.compensation_structures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.personnel p
      WHERE p.id = compensation_structures.personnel_id
        AND p.profile_id = auth.uid()
    )
  );
