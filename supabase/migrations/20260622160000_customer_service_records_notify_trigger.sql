-- Reliable Aurora Manager notifications when a customer service record is submitted.

CREATE OR REPLACE FUNCTION public.notify_aurora_managers_service_record_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending_approval' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.comm_notifications (user_id, type, payload)
  SELECT
    p.id,
    'service_record_pending',
    jsonb_build_object(
      'recordId', NEW.id,
      'demandNumber', NEW.demand_number,
      'vehicleSummary', NEW.vehicle_summary,
      'customerFirstname', NEW.customer_firstname,
      'diagnosisCode', NEW.diagnosis_code,
      'diagnosis', CASE NEW.diagnosis_code
        WHEN 'camera_not_recording' THEN 'Camera not recording'
        WHEN 'sd_card_issue' THEN 'SD card / storage issue'
        WHEN 'power_wiring_issue' THEN 'Power or wiring issue'
        WHEN 'app_connectivity_issue' THEN 'App / connectivity issue'
        WHEN 'display_monitor_issue' THEN 'Display / monitor issue'
        WHEN 'other' THEN COALESCE(NULLIF(trim(NEW.diagnosis_other), ''), 'Other')
        ELSE NEW.diagnosis_code
      END,
      'link', '/dashboard/admin/service-records?status=pending_approval',
      'message', 'New customer service record pending approval.'
    )
  FROM public.profiles p
  WHERE p.role = 'aurora_manager';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_service_records_notify ON public.customer_service_records;
CREATE TRIGGER trg_customer_service_records_notify
  AFTER INSERT ON public.customer_service_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_aurora_managers_service_record_pending();

-- Avoid duplicate notifications when both trigger and RPC insert.
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

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_record_id,
    'status', 'pending_approval'
  );
END;
$$;

-- Backfill notifications for pending records created before the trigger existed.
INSERT INTO public.comm_notifications (user_id, type, payload)
SELECT
  p.id,
  'service_record_pending',
  jsonb_build_object(
    'recordId', r.id,
    'demandNumber', r.demand_number,
    'vehicleSummary', r.vehicle_summary,
    'customerFirstname', r.customer_firstname,
    'diagnosisCode', r.diagnosis_code,
    'diagnosis', CASE r.diagnosis_code
      WHEN 'camera_not_recording' THEN 'Camera not recording'
      WHEN 'sd_card_issue' THEN 'SD card / storage issue'
      WHEN 'power_wiring_issue' THEN 'Power or wiring issue'
      WHEN 'app_connectivity_issue' THEN 'App / connectivity issue'
      WHEN 'display_monitor_issue' THEN 'Display / monitor issue'
      WHEN 'other' THEN COALESCE(NULLIF(trim(r.diagnosis_other), ''), 'Other')
      ELSE r.diagnosis_code
    END,
    'link', '/dashboard/admin/service-records?status=pending_approval',
    'message', 'New customer service record pending approval.'
  )
FROM public.customer_service_records r
CROSS JOIN public.profiles p
WHERE r.status = 'pending_approval'
  AND p.role = 'aurora_manager'
  AND NOT EXISTS (
    SELECT 1
    FROM public.comm_notifications n
    WHERE n.type = 'service_record_pending'
      AND n.payload->>'recordId' = r.id::text
      AND n.user_id = p.id
  );
