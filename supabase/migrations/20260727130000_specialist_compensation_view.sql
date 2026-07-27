-- Manual payroll line items for specialists (Aurora Manager / HR in Employees view).

CREATE TABLE IF NOT EXISTS public.specialist_manual_payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  amount numeric NOT NULL CHECK (amount > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specialist_manual_payroll_profile_period
  ON public.specialist_manual_payroll_items (profile_id, period_start, period_end);

COMMENT ON TABLE public.specialist_manual_payroll_items
  IS 'Ad-hoc gross pay lines for specialists (bonuses, reimbursements, adjustments) visible in Employees compensation view.';

ALTER TABLE public.specialist_manual_payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS specialist_manual_payroll_am_hr ON public.specialist_manual_payroll_items;
CREATE POLICY specialist_manual_payroll_am_hr ON public.specialist_manual_payroll_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('aurora_manager', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('aurora_manager', 'hr')
    )
  );

CREATE OR REPLACE FUNCTION public.get_specialist_period_stats(
  p_profile_ids uuid[],
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  profile_id uuid,
  installations_completed bigint,
  service_jobs_completed bigint,
  service_fee_total numeric,
  expense_reimbursement_total numeric,
  manual_items_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (
    SELECT unnest(COALESCE(p_profile_ids, ARRAY[]::uuid[])) AS profile_id
  ),
  installs AS (
    SELECT
      d.assigned_specialist_id AS profile_id,
      count(*)::bigint AS cnt
    FROM public.demands d
    WHERE d.assigned_specialist_id = ANY(p_profile_ids)
      AND d.status = 'completed'
      AND COALESCE(d.completed_at::date, d.updated_at::date) >= p_period_start
      AND COALESCE(d.completed_at::date, d.updated_at::date) <= p_period_end
    GROUP BY d.assigned_specialist_id
  ),
  services AS (
    SELECT
      r.assigned_specialist_id AS profile_id,
      count(*) FILTER (WHERE r.status = 'completed')::bigint AS cnt
    FROM public.customer_service_records r
    WHERE r.assigned_specialist_id = ANY(p_profile_ids)
      AND r.status = 'completed'
      AND r.completed_at IS NOT NULL
      AND r.completed_at::date >= p_period_start
      AND r.completed_at::date <= p_period_end
    GROUP BY r.assigned_specialist_id
  ),
  earnings AS (
    SELECT
      per.profile_id,
      COALESCE(sum(e.amount) FILTER (WHERE e.earning_type = 'service_fee'), 0)::numeric AS service_fee,
      COALESCE(sum(e.amount) FILTER (WHERE e.earning_type = 'expense_reimbursement'), 0)::numeric AS expense_reimb
    FROM public.service_record_completion_earnings e
    JOIN public.personnel per ON per.id = e.personnel_id
    WHERE per.profile_id = ANY(p_profile_ids)
      AND e.period_month >= date_trunc('month', p_period_start::timestamptz)::date
      AND e.period_month <= date_trunc('month', p_period_end::timestamptz)::date
    GROUP BY per.profile_id
  ),
  manual AS (
    SELECT
      m.profile_id,
      COALESCE(sum(m.amount), 0)::numeric AS total
    FROM public.specialist_manual_payroll_items m
    WHERE m.profile_id = ANY(p_profile_ids)
      AND m.period_start = p_period_start
      AND m.period_end = p_period_end
    GROUP BY m.profile_id
  )
  SELECT
    i.profile_id,
    COALESCE(ins.cnt, 0) AS installations_completed,
    COALESCE(sv.cnt, 0) AS service_jobs_completed,
    COALESCE(er.service_fee, 0) AS service_fee_total,
    COALESCE(er.expense_reimb, 0) AS expense_reimbursement_total,
    COALESCE(mn.total, 0) AS manual_items_total
  FROM ids i
  LEFT JOIN installs ins ON ins.profile_id = i.profile_id
  LEFT JOIN services sv ON sv.profile_id = i.profile_id
  LEFT JOIN earnings er ON er.profile_id = i.profile_id
  LEFT JOIN manual mn ON mn.profile_id = i.profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_specialist_period_stats(uuid[], date, date) TO authenticated;
