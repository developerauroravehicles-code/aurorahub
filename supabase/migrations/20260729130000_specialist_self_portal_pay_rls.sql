-- Specialists can read their own manual payroll lines in Self Portal Pay view.

DROP POLICY IF EXISTS specialist_manual_payroll_self_read ON public.specialist_manual_payroll_items;
CREATE POLICY specialist_manual_payroll_self_read ON public.specialist_manual_payroll_items
  FOR SELECT
  USING (profile_id = auth.uid());
