-- Customer portal service records: warranty/service requests with AM approval workflow.

CREATE TABLE IF NOT EXISTS public.customer_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  demand_number text NOT NULL,
  vin_last6 text NOT NULL,
  customer_firstname text NOT NULL DEFAULT '',
  customer_phone text NOT NULL,
  vehicle_summary text NOT NULL DEFAULT '',
  dealer_name text NOT NULL DEFAULT '',
  diagnosis_code text NOT NULL,
  diagnosis_other text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_approval',
  rejection_reason text NOT NULL DEFAULT '',
  service_appointment_at timestamptz,
  service_location text NOT NULL DEFAULT '18439 68 Ave, Surrey V3S 9H8',
  sms_sent_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_service_records_status_check
    CHECK (status IN ('pending_approval', 'rejected', 'scheduled')),
  CONSTRAINT customer_service_records_diagnosis_check
    CHECK (diagnosis_code IN (
      'camera_not_recording',
      'sd_card_issue',
      'power_wiring_issue',
      'app_connectivity_issue',
      'display_monitor_issue',
      'other'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_service_records_one_pending_per_demand
  ON public.customer_service_records (demand_id)
  WHERE status = 'pending_approval';

CREATE INDEX IF NOT EXISTS idx_customer_service_records_status_created
  ON public.customer_service_records (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_service_records_demand
  ON public.customer_service_records (demand_id, created_at DESC);

COMMENT ON TABLE public.customer_service_records IS
  'Customer portal dashcam service requests; Aurora Manager approves and schedules SMS.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.customer_service_records_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_service_records_set_updated_at ON public.customer_service_records;
CREATE TRIGGER customer_service_records_set_updated_at
  BEFORE UPDATE ON public.customer_service_records
  FOR EACH ROW
  EXECUTE FUNCTION public.customer_service_records_set_updated_at();

ALTER TABLE public.customer_service_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_service_records_am_all ON public.customer_service_records;
CREATE POLICY customer_service_records_am_all ON public.customer_service_records
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

-- comm_notifications: service_record_pending
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
    'service_record_pending'
  ));

-- sms_logs: service appointment SMS
ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_message_type_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_message_type_check
  CHECK (message_type IN (
    'appointment_created',
    'cancellation_notice',
    'rescheduling_notice',
    'four_hour_reminder',
    'twenty_four_hour_reminder',
    'customer_directory_manual',
    'service_appointment_scheduled'
  ));

CREATE OR REPLACE FUNCTION public.customer_portal_create_service_record(
  p_vin_query text,
  p_demand_number text,
  p_diagnosis_code text,
  p_comment text DEFAULT NULL,
  p_diagnosis_other text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demand_id uuid;
  v_demand_number text;
  v_diagnosis text;
  v_comment text;
  v_other text;
  v_record_id uuid;
BEGIN
  v_demand_number := NULLIF(trim(COALESCE(p_demand_number, '')), '');
  IF v_demand_number IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Demand reference is required.');
  END IF;

  v_diagnosis := NULLIF(trim(COALESCE(p_diagnosis_code, '')), '');
  IF v_diagnosis IS NULL OR v_diagnosis NOT IN (
    'camera_not_recording',
    'sd_card_issue',
    'power_wiring_issue',
    'app_connectivity_issue',
    'display_monitor_issue',
    'other'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid issue type.');
  END IF;

  v_comment := NULLIF(left(trim(COALESCE(p_comment, '')), 500), '');
  v_other := NULLIF(left(trim(COALESCE(p_diagnosis_other, '')), 200), '');

  IF v_diagnosis = 'other' AND v_other IS NULL AND v_comment IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please describe your issue when selecting Other.');
  END IF;

  SELECT d.id
  INTO v_demand_id
  FROM public.demands d
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN length(
          upper(regexp_replace(trim(COALESCE(p_vin_query, '')), '[^A-Z0-9]', '', 'g'))
        ) >= 6
        THEN right(
          upper(regexp_replace(trim(COALESCE(p_vin_query, '')), '[^A-Z0-9]', '', 'g')),
          6
        )
        ELSE NULL
      END AS k
  ) vk
  WHERE d.demand_number::text = v_demand_number
    AND vk.k IS NOT NULL
    AND d.vin_last6 IS NOT NULL
    AND upper(regexp_replace(trim(COALESCE(d.vin_last6, '')), '[^A-Z0-9]', '', 'g')) = vk.k
    AND COALESCE(d.status::text, '') = 'completed'
  LIMIT 1;

  IF v_demand_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No completed installation found for this VIN and reference.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_service_records r
    WHERE r.demand_id = v_demand_id AND r.status = 'pending_approval'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A service request is already pending review for this installation.');
  END IF;

  INSERT INTO public.customer_service_records (
    demand_id,
    demand_number,
    vin_last6,
    customer_firstname,
    customer_phone,
    vehicle_summary,
    dealer_name,
    diagnosis_code,
    diagnosis_other,
    comment,
    status
  )
  SELECT
    d.id,
    d.demand_number::text,
    upper(regexp_replace(trim(COALESCE(d.vin_last6, '')), '[^A-Z0-9]', '', 'g')),
    COALESCE(d.customer_firstname, ''),
    trim(COALESCE(d.customer_phone, '')),
    trim(concat_ws(' ', d.vehicle_year::text, COALESCE(d.vehicle_make, ''), COALESCE(d.vehicle_model, ''))),
    COALESCE(dr.name, ''),
    v_diagnosis,
    COALESCE(v_other, ''),
    COALESCE(v_comment, ''),
    'pending_approval'
  FROM public.demands d
  LEFT JOIN public.dealers dr ON dr.id = d.dealer_id
  WHERE d.id = v_demand_id
    AND trim(COALESCE(d.customer_phone, '')) <> ''
  RETURNING id INTO v_record_id;

  IF v_record_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'We cannot submit a service request without a phone number on file. Please contact your dealer.'
    );
  END IF;

  INSERT INTO public.comm_notifications (user_id, type, payload)
  SELECT
    p.id,
    'service_record_pending',
    jsonb_build_object(
      'recordId', v_record_id,
      'demandNumber', v_demand_number,
      'vehicleSummary', (SELECT vehicle_summary FROM public.customer_service_records WHERE id = v_record_id),
      'diagnosisCode', v_diagnosis,
      'link', '/dashboard/admin/service-records?status=pending_approval',
      'message', 'New customer service record pending approval.'
    )
  FROM public.profiles p
  WHERE p.role = 'aurora_manager';

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_record_id,
    'status', 'pending_approval'
  );
END;
$$;

COMMENT ON FUNCTION public.customer_portal_create_service_record(text, text, text, text, text)
  IS 'Customer portal: submit dashcam service record for completed installation (VIN + demand_number).';

GRANT EXECUTE ON FUNCTION public.customer_portal_create_service_record(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_create_service_record(text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_portal_service_records_by_vin(
  p_vin_query text,
  p_demand_number text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  demand_number text,
  status text,
  diagnosis_code text,
  diagnosis_other text,
  comment text,
  rejection_reason text,
  service_appointment_at timestamptz,
  service_location text,
  created_at timestamptz
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
    SELECT
      CASE WHEN length(norm.q) >= 6 THEN right(norm.q, 6) ELSE NULL END AS k
    FROM norm
  ),
  demand_filter AS (
    SELECT NULLIF(trim(COALESCE(p_demand_number, '')), '') AS dn
  )
  SELECT
    r.id,
    r.demand_number,
    r.status,
    r.diagnosis_code,
    r.diagnosis_other,
    r.comment,
    r.rejection_reason,
    r.service_appointment_at,
    r.service_location,
    r.created_at
  FROM public.customer_service_records r
  CROSS JOIN vin_key vk
  CROSS JOIN demand_filter df
  WHERE vk.k IS NOT NULL
    AND upper(regexp_replace(trim(COALESCE(r.vin_last6, '')), '[^A-Z0-9]', '', 'g')) = vk.k
    AND (df.dn IS NULL OR r.demand_number = df.dn)
  ORDER BY r.created_at DESC
  LIMIT 20;
$$;

COMMENT ON FUNCTION public.customer_portal_service_records_by_vin(text, text)
  IS 'Customer portal: list service records for VIN (optional demand_number filter). No phone exposed.';

GRANT EXECUTE ON FUNCTION public.customer_portal_service_records_by_vin(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_service_records_by_vin(text, text) TO authenticated;
