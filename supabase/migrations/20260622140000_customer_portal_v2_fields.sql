-- Customer portal v2: extended lookup fields + optional rating comment.

DROP FUNCTION IF EXISTS public.customer_portal_rate_specialist(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.customer_portal_rate_specialist(
  p_vin_query text,
  p_demand_number text,
  p_customer_rating integer,
  p_quality_score integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demand_id uuid;
  v_specialist_id uuid;
  v_demand_number text;
  v_comment text;
BEGIN
  IF p_customer_rating IS NULL OR p_customer_rating < 1 OR p_customer_rating > 5
     OR p_quality_score IS NULL OR p_quality_score < 1 OR p_quality_score > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ratings must be between 1 and 5.');
  END IF;

  v_demand_number := NULLIF(trim(COALESCE(p_demand_number, '')), '');
  IF v_demand_number IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Demand reference is required.');
  END IF;

  v_comment := NULLIF(left(trim(COALESCE(p_comment, '')), 500), '');

  SELECT d.id, d.assigned_specialist_id
  INTO v_demand_id, v_specialist_id
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

  IF v_specialist_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No specialist is assigned to this installation yet.');
  END IF;

  INSERT INTO public.demand_customer_ratings (demand_id, customer_rating, quality_score, comment)
  VALUES (v_demand_id, p_customer_rating, p_quality_score, v_comment)
  ON CONFLICT (demand_id) DO UPDATE
  SET
    customer_rating = EXCLUDED.customer_rating,
    quality_score = EXCLUDED.quality_score,
    comment = EXCLUDED.comment,
    updated_at = now();

  PERFORM public.refresh_installer_scores_from_customer_ratings(v_specialist_id);

  RETURN jsonb_build_object(
    'ok', true,
    'customer_rating', p_customer_rating,
    'quality_score', p_quality_score,
    'comment', v_comment
  );
END;
$$;

COMMENT ON FUNCTION public.customer_portal_rate_specialist(text, text, integer, integer, text)
  IS 'Customer portal: rate specialist for a completed demand (VIN + demand_number). Optional comment up to 500 chars.';

GRANT EXECUTE ON FUNCTION public.customer_portal_rate_specialist(text, text, integer, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_rate_specialist(text, text, integer, integer, text) TO authenticated;

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
  camera_model text,
  warranty_end date,
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
  stock_number text
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
      CASE
        WHEN length(norm.q) >= 6 THEN right(norm.q, 6)
        ELSE NULL
      END AS k
    FROM norm
  )
  SELECT
    d.demand_number::text,
    d.status::text,
    d.appointment_date,
    d.vehicle_year::integer,
    COALESCE(d.vehicle_make, '')::text,
    COALESCE(d.vehicle_model, '')::text,
    COALESCE(dr.name, '')::text,
    COALESCE(d.camera_model, '')::text,
    CASE
      WHEN d.status::text = 'completed' AND COALESCE(d.completed_at, d.updated_at) IS NOT NULL
      THEN ((COALESCE(d.completed_at, d.updated_at))::date + interval '3 years')::date
      ELSE NULL
    END AS warranty_end,
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
    COALESCE(d.stock_number, '')::text AS stock_number
  FROM public.demands d
  CROSS JOIN vin_key vk
  LEFT JOIN public.dealers dr ON dr.id = d.dealer_id
  LEFT JOIN public.region_codes rc ON rc.id = dr.region_code_id
  LEFT JOIN public.timezones tz ON tz.id = rc.timezone_id
  LEFT JOIN public.profiles sp ON sp.id = d.assigned_specialist_id
  LEFT JOIN public.demand_customer_ratings r ON r.demand_id = d.id
  WHERE vk.k IS NOT NULL
    AND d.vin_last6 IS NOT NULL
    AND upper(regexp_replace(trim(COALESCE(d.vin_last6, '')), '[^A-Z0-9]', '', 'g')) = vk.k
    AND COALESCE(d.status::text, '') <> 'cancelled'
  ORDER BY d.appointment_date DESC NULLS LAST
  LIMIT 15;
$$;

COMMENT ON FUNCTION public.customer_portal_lookup_by_vin(text)
  IS 'Customer portal VIN lookup (last 6 digits): installation, dealer, warranty, and rating fields.';

GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO authenticated;
