-- Customer Portal v2: magic link tokens, portal content, service ticket workflow, payroll earnings.

-- ---------------------------------------------------------------------------
-- Phone normalization (10-digit Canadian, digits only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_portal_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(d) = 11 AND left(d, 1) = '1' THEN substring(d FROM 2)
    ELSE d
  END
  FROM (
    SELECT regexp_replace(trim(COALESCE(p_phone, '')), '\D', '', 'g') AS d
  ) x
  WHERE length(
    CASE
      WHEN length(d) = 11 AND left(d, 1) = '1' THEN substring(d FROM 2)
      ELSE d
    END
  ) = 10;
$$;

COMMENT ON FUNCTION public.normalize_portal_phone(text)
  IS 'Normalize customer phone to 10-digit Canadian format for portal token lookup.';

-- ---------------------------------------------------------------------------
-- Magic link access tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_portal_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  customer_phone text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_portal_access_tokens_phone
  ON public.customer_portal_access_tokens (customer_phone);

CREATE INDEX IF NOT EXISTS idx_customer_portal_access_tokens_expires
  ON public.customer_portal_access_tokens (expires_at);

COMMENT ON TABLE public.customer_portal_access_tokens
  IS 'SHA-256 hashed magic link tokens for customer portal phone-based access.';

ALTER TABLE public.customer_portal_access_tokens ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Camera model portal content
-- ---------------------------------------------------------------------------
ALTER TABLE public.camera_models
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS user_manual_url text,
  ADD COLUMN IF NOT EXISTS troubleshooting_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.camera_models.image_url IS 'Stock photo URL for customer portal.';
COMMENT ON COLUMN public.camera_models.user_manual_url IS 'PDF/manual download URL for customer portal.';
COMMENT ON COLUMN public.camera_models.troubleshooting_json IS 'Array of {title, body} troubleshooting entries for customer portal.';

-- ---------------------------------------------------------------------------
-- Service records workflow extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_service_records
  ADD COLUMN IF NOT EXISTS assigned_specialist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_fee_amount numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS compensation_recorded_at timestamptz;

ALTER TABLE public.customer_service_records
  DROP CONSTRAINT IF EXISTS customer_service_records_status_check;

ALTER TABLE public.customer_service_records
  ADD CONSTRAINT customer_service_records_status_check
  CHECK (status IN (
    'pending_approval',
    'rejected',
    'scheduled',
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_customer_service_records_assigned_specialist
  ON public.customer_service_records (assigned_specialist_id, status);

CREATE TABLE IF NOT EXISTS public.service_record_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_record_id uuid NOT NULL REFERENCES public.customer_service_records(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('travel', 'meals', 'other')),
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text NOT NULL DEFAULT '',
  payroll_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_record_expenses_record
  ON public.service_record_expenses (service_record_id, status);

CREATE TABLE IF NOT EXISTS public.service_record_completion_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.customer_service_records(id) ON DELETE CASCADE,
  expense_id uuid REFERENCES public.service_record_expenses(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  earning_type text NOT NULL CHECK (earning_type IN ('service_fee', 'expense_reimbursement')),
  period_month date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_record_completion_earnings_service_fee_unique
  ON public.service_record_completion_earnings (service_record_id)
  WHERE earning_type = 'service_fee';

CREATE UNIQUE INDEX IF NOT EXISTS service_record_completion_earnings_expense_unique
  ON public.service_record_completion_earnings (expense_id)
  WHERE expense_id IS NOT NULL;

ALTER TABLE public.service_record_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_record_completion_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_record_expenses_am_all ON public.service_record_expenses;
CREATE POLICY service_record_expenses_am_all ON public.service_record_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'aurora_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'aurora_manager'
    )
  );

DROP POLICY IF EXISTS service_record_expenses_specialist_own ON public.service_record_expenses;
CREATE POLICY service_record_expenses_specialist_own ON public.service_record_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_service_records r
      WHERE r.id = service_record_id
        AND r.assigned_specialist_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customer_service_records r
      WHERE r.id = service_record_id
        AND r.assigned_specialist_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_record_completion_earnings_hr_am ON public.service_record_completion_earnings;
CREATE POLICY service_record_completion_earnings_hr_am ON public.service_record_completion_earnings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('aurora_manager', 'hr')
    )
  );

DROP POLICY IF EXISTS customer_service_records_specialist_assigned ON public.customer_service_records;
CREATE POLICY customer_service_records_specialist_assigned ON public.customer_service_records
  FOR SELECT
  USING (assigned_specialist_id = auth.uid());

DROP POLICY IF EXISTS customer_service_records_specialist_update ON public.customer_service_records;
CREATE POLICY customer_service_records_specialist_update ON public.customer_service_records
  FOR UPDATE
  USING (assigned_specialist_id = auth.uid())
  WITH CHECK (assigned_specialist_id = auth.uid());

-- SMS log type for AM pending notification
ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_message_type_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_message_type_check
  CHECK (message_type IN (
    'appointment_created',
    'cancellation_notice',
    'rescheduling_notice',
    'four_hour_reminder',
    'twenty_four_hour_reminder',
    'customer_directory_manual',
    'service_appointment_scheduled',
    'service_record_pending'
  ));

-- Default portal contact settings
INSERT INTO public.system_settings (key, value)
VALUES (
  'portal_contact',
  '{"phone":"(604) 833-5801","email":"support@auroravehicles.com","hours":"Mon–Fri 9:00 AM – 5:00 PM PT"}'
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Shared portal lookup projection (VIN + phone)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_portal_lookup_rows(
  p_phone_key text DEFAULT NULL,
  p_vin_key text DEFAULT NULL
)
RETURNS TABLE (
  demand_number text,
  status text,
  appointment_date timestamptz,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text,
  dealer_name text,
  dealer_warranty_years integer,
  camera_model text,
  warranty_end date,
  sd_card_warranty_end date,
  camera_image_url text,
  camera_manual_url text,
  camera_troubleshooting jsonb,
  specialist_name text,
  rated_customer_rating integer,
  rated_quality_score integer,
  can_rate boolean,
  customer_firstname text,
  customer_address text,
  service_type text,
  completed_at timestamptz,
  dealer_address text,
  dealer_phone text,
  dealer_timezone text,
  rated_comment text,
  stock_number text,
  vin_last6 text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.demand_number::text,
    d.status::text,
    d.appointment_date,
    d.vehicle_year::integer,
    COALESCE(d.vehicle_make, '')::text,
    COALESCE(d.vehicle_model, '')::text,
    COALESCE(dr.name, '')::text,
    COALESCE(dr.warranty_years, 3)::integer AS dealer_warranty_years,
    COALESCE(d.camera_model, '')::text,
    CASE
      WHEN d.status::text = 'completed' AND COALESCE(d.completed_at, d.updated_at) IS NOT NULL
      THEN (
        (COALESCE(d.completed_at, d.updated_at))::date
        + (COALESCE(dr.warranty_years, 3) || ' years')::interval
      )::date
      ELSE NULL
    END AS warranty_end,
    CASE
      WHEN d.status::text = 'completed' AND COALESCE(d.completed_at, d.updated_at) IS NOT NULL
      THEN ((COALESCE(d.completed_at, d.updated_at))::date + interval '6 months')::date
      ELSE NULL
    END AS sd_card_warranty_end,
    COALESCE(cm.image_url, '')::text AS camera_image_url,
    COALESCE(cm.user_manual_url, '')::text AS camera_manual_url,
    COALESCE(cm.troubleshooting_json, '[]'::jsonb) AS camera_troubleshooting,
    COALESCE(NULLIF(trim(sp.full_name), ''), 'Your specialist')::text AS specialist_name,
    r.customer_rating::integer AS rated_customer_rating,
    r.quality_score::integer AS rated_quality_score,
    (
      d.status::text = 'completed'
      AND d.assigned_specialist_id IS NOT NULL
    )::boolean AS can_rate,
    COALESCE(d.customer_firstname, '')::text AS customer_firstname,
    COALESCE(d.customer_address, '')::text AS customer_address,
    COALESCE(d.service_type::text, '')::text AS service_type,
    d.completed_at,
    COALESCE(dr.address, '')::text AS dealer_address,
    COALESCE(dr.phone, '')::text AS dealer_phone,
    COALESCE(tz.name, '')::text AS dealer_timezone,
    COALESCE(r.comment, '')::text AS rated_comment,
    COALESCE(d.stock_number, '')::text AS stock_number,
    upper(regexp_replace(trim(COALESCE(d.vin_last6, '')), '[^A-Z0-9]', '', 'g'))::text AS vin_last6
  FROM public.demands d
  LEFT JOIN public.dealers dr ON dr.id = d.dealer_id
  LEFT JOIN public.region_codes rc ON rc.id = dr.region_code_id
  LEFT JOIN public.timezones tz ON tz.id = rc.timezone_id
  LEFT JOIN public.profiles sp ON sp.id = d.assigned_specialist_id
  LEFT JOIN public.demand_customer_ratings r ON r.demand_id = d.id
  LEFT JOIN public.camera_models cm ON cm.id = d.camera_model_id
    OR (d.camera_model_id IS NULL AND lower(trim(cm.name)) = lower(trim(COALESCE(d.camera_model, ''))))
  WHERE COALESCE(d.status::text, '') <> 'cancelled'
    AND (
      (p_vin_key IS NOT NULL AND d.vin_last6 IS NOT NULL
        AND upper(regexp_replace(trim(COALESCE(d.vin_last6, '')), '[^A-Z0-9]', '', 'g')) = p_vin_key)
      OR
      (p_phone_key IS NOT NULL AND public.normalize_portal_phone(d.customer_phone) = p_phone_key)
    )
  ORDER BY d.appointment_date DESC NULLS LAST
  LIMIT 15;
$$;

DROP FUNCTION IF EXISTS public.customer_portal_lookup_by_vin(text);

CREATE OR REPLACE FUNCTION public.customer_portal_lookup_by_vin(p_vin_query text)
RETURNS TABLE (
  demand_number text,
  status text,
  appointment_date timestamptz,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text,
  dealer_name text,
  dealer_warranty_years integer,
  camera_model text,
  warranty_end date,
  sd_card_warranty_end date,
  camera_image_url text,
  camera_manual_url text,
  camera_troubleshooting jsonb,
  specialist_name text,
  rated_customer_rating integer,
  rated_quality_score integer,
  can_rate boolean,
  customer_firstname text,
  customer_address text,
  service_type text,
  completed_at timestamptz,
  dealer_address text,
  dealer_phone text,
  dealer_timezone text,
  rated_comment text,
  stock_number text,
  vin_last6 text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH norm AS (
    SELECT upper(regexp_replace(trim(COALESCE(p_vin_query, '')), '[^A-Z0-9]', '', 'g')) AS q
  ),
  vin_key AS (
    SELECT CASE WHEN length(norm.q) >= 6 THEN right(norm.q, 6) ELSE NULL END AS k
    FROM norm
  )
  SELECT
    l.demand_number,
    l.status,
    l.appointment_date,
    l.vehicle_year,
    l.vehicle_make,
    l.vehicle_model,
    l.dealer_name,
    l.dealer_warranty_years,
    l.camera_model,
    l.warranty_end,
    l.sd_card_warranty_end,
    l.camera_image_url,
    l.camera_manual_url,
    l.camera_troubleshooting,
    l.specialist_name,
    l.rated_customer_rating,
    l.rated_quality_score,
    l.can_rate,
    l.customer_firstname,
    l.customer_address,
    l.service_type,
    l.completed_at,
    l.dealer_address,
    l.dealer_phone,
    l.dealer_timezone,
    l.rated_comment,
    l.stock_number,
    l.vin_last6
  FROM vin_key vk
  CROSS JOIN LATERAL public.customer_portal_lookup_rows(NULL, vk.k) l
  WHERE vk.k IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_lookup_by_phone(p_phone text)
RETURNS TABLE (
  demand_number text,
  status text,
  appointment_date timestamptz,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text,
  dealer_name text,
  dealer_warranty_years integer,
  camera_model text,
  warranty_end date,
  sd_card_warranty_end date,
  camera_image_url text,
  camera_manual_url text,
  camera_troubleshooting jsonb,
  specialist_name text,
  rated_customer_rating integer,
  rated_quality_score integer,
  can_rate boolean,
  customer_firstname text,
  customer_address text,
  service_type text,
  completed_at timestamptz,
  dealer_address text,
  dealer_phone text,
  dealer_timezone text,
  rated_comment text,
  stock_number text,
  vin_last6 text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.demand_number,
    l.status,
    l.appointment_date,
    l.vehicle_year,
    l.vehicle_make,
    l.vehicle_model,
    l.dealer_name,
    l.dealer_warranty_years,
    l.camera_model,
    l.warranty_end,
    l.sd_card_warranty_end,
    l.camera_image_url,
    l.camera_manual_url,
    l.camera_troubleshooting,
    l.specialist_name,
    l.rated_customer_rating,
    l.rated_quality_score,
    l.can_rate,
    l.customer_firstname,
    l.customer_address,
    l.service_type,
    l.completed_at,
    l.dealer_address,
    l.dealer_phone,
    l.dealer_timezone,
    l.rated_comment,
    l.stock_number,
    l.vin_last6
  FROM public.customer_portal_lookup_rows(public.normalize_portal_phone(p_phone), NULL) l
  WHERE public.normalize_portal_phone(p_phone) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_validate_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_row public.customer_portal_access_tokens%ROWTYPE;
BEGIN
  IF NULLIF(trim(COALESCE(p_token, '')), '') IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'expired', false, 'customer_phone', null);
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_row
  FROM public.customer_portal_access_tokens t
  WHERE t.token_hash = v_hash
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'expired', false, 'customer_phone', null);
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'expired', true, 'customer_phone', null);
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'expired', true,
      'customer_phone', v_row.customer_phone
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'expired', false,
    'customer_phone', v_row.customer_phone
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_portal_get_contact()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT value::jsonb
      FROM public.system_settings
      WHERE key = 'portal_contact'
      LIMIT 1
    ),
    '{"phone":"","email":"","hours":""}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.get_service_completion_earnings_for_payroll(
  p_personnel_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  id uuid,
  service_record_id uuid,
  expense_id uuid,
  amount numeric,
  earning_type text,
  period_month date,
  demand_number text,
  description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.service_record_id,
    e.expense_id,
    e.amount,
    e.earning_type,
    e.period_month,
    r.demand_number,
    CASE
      WHEN e.earning_type = 'expense_reimbursement' THEN COALESCE(x.description, 'Expense reimbursement')
      ELSE 'Service completion ($20)'
    END AS description
  FROM public.service_record_completion_earnings e
  JOIN public.customer_service_records r ON r.id = e.service_record_id
  LEFT JOIN public.service_record_expenses x ON x.id = e.expense_id
  WHERE e.personnel_id = p_personnel_id
    AND e.period_month >= date_trunc('month', p_period_start::timestamptz)::date
    AND e.period_month <= date_trunc('month', p_period_end::timestamptz)::date
  ORDER BY e.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_validate_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_get_contact() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_service_completion_earnings_for_payroll(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_portal_phone(text) TO anon, authenticated;

COMMENT ON FUNCTION public.customer_portal_lookup_by_phone(text)
  IS 'Customer portal phone lookup: same installation set as VIN lookup (max 15, excludes cancelled).';
COMMENT ON FUNCTION public.customer_portal_validate_token(text)
  IS 'Validate magic link token; returns valid/expired/customer_phone.';
COMMENT ON FUNCTION public.customer_portal_get_contact()
  IS 'Portal footer contact info from system_settings.portal_contact.';
