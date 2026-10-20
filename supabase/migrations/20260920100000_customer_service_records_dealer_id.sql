-- Link service records to dealers for calendar / scheduling pool.

ALTER TABLE public.customer_service_records
  ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_service_records_dealer_id
  ON public.customer_service_records (dealer_id);

UPDATE public.customer_service_records r
SET dealer_id = d.dealer_id
FROM public.demands d
WHERE d.id = r.demand_id
  AND r.dealer_id IS NULL;

-- Portal RPC: persist dealer_id on create.
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
    dealer_id,
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
    d.dealer_id,
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
