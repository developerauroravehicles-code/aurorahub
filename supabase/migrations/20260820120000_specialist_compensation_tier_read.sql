-- Specialists can read their own per-completed tier for Self Portal pay estimates.

DROP POLICY IF EXISTS compensation_per_completed_self_read ON public.compensation_per_completed;
CREATE POLICY compensation_per_completed_self_read ON public.compensation_per_completed
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.personnel p
      WHERE p.id = compensation_per_completed.personnel_id
        AND p.profile_id = auth.uid()
    )
  );
