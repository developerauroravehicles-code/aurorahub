-- Expense categories (travel/meals/fuel/extra_duty), Extra Duty fields, payable_on, AM notifications.

ALTER TABLE public.specialist_expense_claims
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS hourly_rate_used numeric,
  ADD COLUMN IF NOT EXISTS payable_on date,
  ADD COLUMN IF NOT EXISTS payroll_applied_at timestamptz;

COMMENT ON COLUMN public.specialist_expense_claims.duration_minutes IS 'Extra Duty: total minutes worked';
COMMENT ON COLUMN public.specialist_expense_claims.hourly_rate_used IS 'Extra Duty: 1.5x hourly rate used at submission';
COMMENT ON COLUMN public.specialist_expense_claims.payable_on IS 'Pay date (next salary installment) set on approval';

UPDATE public.specialist_expense_claims SET category = 'travel' WHERE category IN ('supplies', 'other');

ALTER TABLE public.specialist_expense_claims DROP CONSTRAINT IF EXISTS specialist_expense_claims_category_check;
ALTER TABLE public.specialist_expense_claims ADD CONSTRAINT specialist_expense_claims_category_check
  CHECK (category IN ('travel', 'meals', 'fuel', 'extra_duty'));

ALTER TABLE public.comm_notifications DROP CONSTRAINT IF EXISTS comm_notifications_type_check;
ALTER TABLE public.comm_notifications ADD CONSTRAINT comm_notifications_type_check
  CHECK (type IN (
    'chat_message',
    'meet_invite',
    'meet_started',
    'mention',
    'sms_pending',
    'daily_invoice_review',
    'daily_invoice_send_failed',
    'daily_invoice_missed',
    'service_record_pending',
    'duplicate_stock_number',
    'inventory_stock_alert',
    'demand_fields_updated',
    'expense_claim_pending'
  ));

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
  manual_items_total numeric,
  expense_claims_total numeric
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
  ),
  expense_claims AS (
    SELECT
      c.profile_id,
      COALESCE(sum(c.amount) FILTER (WHERE c.status = 'approved'), 0)::numeric AS total
    FROM public.specialist_expense_claims c
    WHERE c.profile_id = ANY(p_profile_ids)
      AND c.status = 'approved'
      AND c.payroll_applied_at IS NULL
      AND COALESCE(c.payable_on, c.expense_date) >= p_period_start
      AND COALESCE(c.payable_on, c.expense_date) <= p_period_end
    GROUP BY c.profile_id
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
    COALESCE(mn.total, 0) AS manual_items_total,
    COALESCE(ec.total, 0) AS expense_claims_total
  FROM ids i
  LEFT JOIN demand_stats ds ON ds.profile_id = i.profile_id
  LEFT JOIN services sv ON sv.profile_id = i.profile_id
  LEFT JOIN earnings er ON er.profile_id = i.profile_id
  LEFT JOIN manual mn ON mn.profile_id = i.profile_id
  LEFT JOIN expense_claims ec ON ec.profile_id = i.profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_specialist_period_stats(uuid[], date, date) TO authenticated;
