-- Public customer portal: lookup limited demand info by VIN (full or last 6).
-- SECURITY DEFINER so anon can call without demands SELECT RLS.

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
  warranty_end date
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
    END AS warranty_end
  FROM public.demands d
  CROSS JOIN vin_key vk
  LEFT JOIN public.dealers dr ON dr.id = d.dealer_id
  WHERE vk.k IS NOT NULL
    AND d.vin_last6 IS NOT NULL
    AND upper(regexp_replace(trim(COALESCE(d.vin_last6, '')), '[^A-Z0-9]', '', 'g')) = vk.k
    AND COALESCE(d.status::text, '') <> 'cancelled'
  ORDER BY d.appointment_date DESC NULLS LAST
  LIMIT 15;
$$;

COMMENT ON FUNCTION public.customer_portal_lookup_by_vin(text)
  IS 'Returns limited installation/warranty rows for anon customer portal VIN lookup (matched on last 6 of normalized VIN).';

GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO authenticated;
