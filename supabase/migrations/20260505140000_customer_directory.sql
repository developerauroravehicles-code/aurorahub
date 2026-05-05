-- Customer directory RPCs: aggregate demands by normalized phone (digits only).
-- SECURITY INVOKER so row-level security on demands applies.

CREATE OR REPLACE FUNCTION public.customer_directory_summaries()
RETURNS TABLE (
  phone_key text,
  customer_phone text,
  customer_firstname text,
  customer_lastname text,
  demand_count bigint,
  last_activity timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      regexp_replace(trim(COALESCE(d.customer_phone, '')), '\D', '', 'g') AS phone_key,
      d.customer_phone,
      d.customer_firstname,
      d.customer_lastname,
      d.updated_at,
      d.created_at
    FROM demands d
  ),
  filtered AS (
    SELECT * FROM normalized WHERE length(phone_key) > 0
  ),
  latest AS (
    SELECT DISTINCT ON (f.phone_key)
      f.phone_key,
      f.customer_phone,
      f.customer_firstname,
      f.customer_lastname
    FROM filtered f
    ORDER BY f.phone_key, GREATEST(f.updated_at, f.created_at) DESC
  ),
  counts AS (
    SELECT f.phone_key, count(*)::bigint AS demand_count
    FROM filtered f
    GROUP BY f.phone_key
  ),
  last_act AS (
    SELECT f.phone_key, max(GREATEST(f.updated_at, f.created_at)) AS last_activity
    FROM filtered f
    GROUP BY f.phone_key
  )
  SELECT
    l.phone_key,
    l.customer_phone::text,
    l.customer_firstname::text,
    l.customer_lastname::text,
    c.demand_count,
    la.last_activity
  FROM latest l
  INNER JOIN counts c USING (phone_key)
  INNER JOIN last_act la USING (phone_key)
  ORDER BY la.last_activity DESC NULLS LAST;
$$;

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
