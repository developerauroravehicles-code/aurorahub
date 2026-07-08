-- Per-dealer invoice warranty duration (1–5 years, default 3).

ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS warranty_years integer NOT NULL DEFAULT 3;

ALTER TABLE public.dealers
  DROP CONSTRAINT IF EXISTS dealers_warranty_years_range;

ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_warranty_years_range
  CHECK (warranty_years >= 1 AND warranty_years <= 5);

COMMENT ON COLUMN public.dealers.warranty_years
  IS 'Installation warranty length in years shown on invoices and customer portal (1–5, default 3).';

-- Preserve existing Aurora Vehicles HQ policy.
UPDATE public.dealers
SET warranty_years = 1
WHERE lower(trim(name)) = 'aurora vehicles hq';

CREATE OR REPLACE FUNCTION public.warranty_interval_for_dealer(p_dealer_name text)
RETURNS interval
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (COALESCE(
    (
      SELECT d.warranty_years
      FROM public.dealers d
      WHERE lower(trim(d.name)) = lower(trim(COALESCE(p_dealer_name, '')))
      LIMIT 1
    ),
    3
  ) || ' years')::interval;
$$;

COMMENT ON FUNCTION public.warranty_interval_for_dealer(text)
  IS 'Installation warranty interval from dealers.warranty_years (fallback 3 years).';

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
      dr.name AS dealer_name,
      dr.warranty_years AS dealer_warranty_years
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
      fd.dealer_warranty_years,
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
        + (COALESCE(l.dealer_warranty_years, 3) || ' years')::interval
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

DROP FUNCTION IF EXISTS public.customer_directory_demands(text);

CREATE OR REPLACE FUNCTION public.customer_directory_demands(p_phone_key text)
RETURNS TABLE (
  id uuid,
  demand_number text,
  status text,
  camera_model text,
  completed_at timestamptz,
  updated_at timestamptz,
  dealer_id uuid,
  dealer_name text,
  dealer_warranty_years integer,
  customer_firstname text,
  customer_lastname text,
  customer_phone text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.demand_number,
    d.status::text,
    d.camera_model,
    d.completed_at,
    d.updated_at,
    d.dealer_id,
    dr.name::text AS dealer_name,
    COALESCE(dr.warranty_years, 3)::integer AS dealer_warranty_years,
    d.customer_firstname::text,
    d.customer_lastname::text,
    d.customer_phone::text
  FROM demands d
  LEFT JOIN dealers dr ON dr.id = d.dealer_id
  WHERE
    length(trim(COALESCE(p_phone_key, ''))) > 0
    AND regexp_replace(trim(COALESCE(d.customer_phone, '')), '\D', '', 'g') = trim(p_phone_key)
  ORDER BY d.updated_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.customer_directory_summaries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_directory_demands(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO authenticated;
