-- Specialist net pay: delay fee tier on demands + service-type breakdown in period stats.

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS delay_fee_tier text NOT NULL DEFAULT 'none'
    CHECK (delay_fee_tier IN ('none', '30min', '60min'));

COMMENT ON COLUMN public.demands.delay_fee_tier IS
  'Specialist-reported wait delay at completion: none, 30min ($20 USD), or 60min ($30 USD).';

-- Return type changed (new columns); must drop before recreate.
DROP FUNCTION IF EXISTS public.get_specialist_period_stats(uuid[], date, date);

CREATE FUNCTION public.get_specialist_period_stats(
  p_profile_ids uuid[],
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  profile_id uuid,
  installations_completed bigint,
  removals_completed bigint,
  transfers_completed bigint,
  delay_30min_count bigint,
  delay_60min_count bigint,
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
  demand_stats AS (
    SELECT
      d.assigned_specialist_id AS profile_id,
      count(*) FILTER (
        WHERE d.service_type IS NULL OR d.service_type = 'installation'
      )::bigint AS installs,
      count(*) FILTER (WHERE d.service_type = 'removal')::bigint AS removals,
      count(*) FILTER (WHERE d.service_type = 'transfer')::bigint AS transfers,
      count(*) FILTER (WHERE d.delay_fee_tier = '30min')::bigint AS delay_30,
      count(*) FILTER (WHERE d.delay_fee_tier = '60min')::bigint AS delay_60
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
    COALESCE(ds.installs, 0) AS installations_completed,
    COALESCE(ds.removals, 0) AS removals_completed,
    COALESCE(ds.transfers, 0) AS transfers_completed,
    COALESCE(ds.delay_30, 0) AS delay_30min_count,
    COALESCE(ds.delay_60, 0) AS delay_60min_count,
    COALESCE(sv.cnt, 0) AS service_jobs_completed,
    COALESCE(er.service_fee, 0) AS service_fee_total,
    COALESCE(er.expense_reimb, 0) AS expense_reimbursement_total,
    COALESCE(mn.total, 0) AS manual_items_total
  FROM ids i
  LEFT JOIN demand_stats ds ON ds.profile_id = i.profile_id
  LEFT JOIN services sv ON sv.profile_id = i.profile_id
  LEFT JOIN earnings er ON er.profile_id = i.profile_id
  LEFT JOIN manual mn ON mn.profile_id = i.profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_specialist_period_stats(uuid[], date, date) TO authenticated;
