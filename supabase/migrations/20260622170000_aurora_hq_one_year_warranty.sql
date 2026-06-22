-- Aurora Vehicles HQ: 1-year installation warranty; all other dealers remain 3 years.

CREATE OR REPLACE FUNCTION public.warranty_interval_for_dealer(p_dealer_name text)
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(trim(COALESCE(p_dealer_name, ''))) = 'aurora vehicles hq' THEN interval '1 year'
    ELSE interval '3 years'
  END;
$$;

COMMENT ON FUNCTION public.warranty_interval_for_dealer(text)
  IS 'Installation warranty length by dealer name (Aurora Vehicles HQ = 1 year, others = 3 years).';

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
      THEN (
        (COALESCE(d.completed_at, d.updated_at))::date
        + public.warranty_interval_for_dealer(dr.name)
      )::date
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

DROP FUNCTION IF EXISTS public.customer_directory_summaries();

CREATE OR REPLACE FUNCTION public.customer_directory_summaries()
RETURNS TABLE (
  phone_key text,
  customer_phone text,
  customer_firstname text,
  customer_lastname text,
  demand_count bigint,
  last_activity timestamptz,
  latest_camera_model text,
  latest_dealer_name text,
  latest_warranty_end date,
  last_sms_at timestamptz,
  last_sms_body text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered_demands AS (
    SELECT
      regexp_replace(trim(COALESCE(d.customer_phone, '')), '\D', '', 'g') AS phone_key,
      d.customer_phone,
      d.customer_firstname,
      d.customer_lastname,
      d.updated_at,
      d.created_at,
      d.camera_model,
      d.status,
      d.completed_at,
      dr.name AS dealer_name
    FROM demands d
    LEFT JOIN dealers dr ON dr.id = d.dealer_id
    WHERE length(regexp_replace(trim(COALESCE(d.customer_phone, '')), '\D', '', 'g')) > 0
  ),
  latest_per_phone AS (
    SELECT DISTINCT ON (fd.phone_key)
      fd.phone_key,
      fd.customer_phone,
      fd.customer_firstname,
      fd.customer_lastname,
      fd.camera_model,
      fd.dealer_name,
      fd.status,
      fd.completed_at,
      fd.updated_at
    FROM filtered_demands fd
    ORDER BY fd.phone_key, GREATEST(fd.updated_at, fd.created_at) DESC
  ),
  counts AS (
    SELECT fd.phone_key, count(*)::bigint AS demand_count
    FROM filtered_demands fd
    GROUP BY fd.phone_key
  ),
  last_act AS (
    SELECT fd.phone_key, max(GREATEST(fd.updated_at, fd.created_at)) AS last_activity
    FROM filtered_demands fd
    GROUP BY fd.phone_key
  ),
  last_sms AS (
    SELECT DISTINCT ON (regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g'))
      regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g') AS phone_key,
      sl.sent_at AS last_sms_at,
      sl.message_content AS last_sms_body
    FROM sms_logs sl
    WHERE sl.recipient_type = 'customer'
      AND length(regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g')) > 0
    ORDER BY regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g'), sl.sent_at DESC
  )
  SELECT
    l.phone_key,
    l.customer_phone::text,
    l.customer_firstname::text,
    l.customer_lastname::text,
    c.demand_count,
    la.last_activity,
    COALESCE(l.camera_model, '')::text AS latest_camera_model,
    COALESCE(l.dealer_name, '')::text AS latest_dealer_name,
    CASE
      WHEN (l.status)::text = 'completed'
        AND COALESCE(l.completed_at, l.updated_at) IS NOT NULL
      THEN (
        COALESCE(l.completed_at, l.updated_at)::date
        + public.warranty_interval_for_dealer(l.dealer_name)
      )::date
      ELSE NULL
    END AS latest_warranty_end,
    ls.last_sms_at,
    ls.last_sms_body
  FROM latest_per_phone l
  INNER JOIN counts c USING (phone_key)
  INNER JOIN last_act la USING (phone_key)
  LEFT JOIN last_sms ls USING (phone_key)
  ORDER BY la.last_activity DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.customer_directory_summaries() TO authenticated;
