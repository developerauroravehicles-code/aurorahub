-- Extend customer_directory_summaries with latest demand camera, dealer, warranty end (completed + 3y).
-- DROP required: PostgreSQL does not allow changing RETURNS TABLE columns via CREATE OR REPLACE (42P13).

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
  latest_warranty_end date
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
      THEN (COALESCE(l.completed_at, l.updated_at) + interval '3 years')::date
      ELSE NULL
    END AS latest_warranty_end
  FROM latest_per_phone l
  INNER JOIN counts c USING (phone_key)
  INNER JOIN last_act la USING (phone_key)
  ORDER BY la.last_activity DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.customer_directory_summaries() TO authenticated;
