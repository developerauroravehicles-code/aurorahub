-- Customer portal: rate installation specialist (1–5 customer rating + quality score).
-- Aggregates update installer_profiles.customer_rating and quality_score.

CREATE TABLE IF NOT EXISTS public.demand_customer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  customer_rating smallint NOT NULL CHECK (customer_rating BETWEEN 1 AND 5),
  quality_score smallint NOT NULL CHECK (quality_score BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demand_customer_ratings_demand_id_key UNIQUE (demand_id)
);

CREATE INDEX IF NOT EXISTS idx_demand_customer_ratings_demand_id
  ON public.demand_customer_ratings(demand_id);

ALTER TABLE public.demand_customer_ratings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.demand_customer_ratings
  IS 'One customer rating per completed demand; drives installer_profiles customer_rating and quality_score averages.';

-- Recompute installer profile scores from all portal ratings for that specialist.
CREATE OR REPLACE FUNCTION public.refresh_installer_scores_from_customer_ratings(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_personnel_id uuid;
  v_customer_avg numeric;
  v_quality_avg numeric;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT per.id INTO v_personnel_id
  FROM public.personnel per
  WHERE per.profile_id = p_profile_id
  LIMIT 1;

  IF v_personnel_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    ROUND(AVG(r.customer_rating)::numeric, 2),
    ROUND(AVG(r.quality_score)::numeric, 2)
  INTO v_customer_avg, v_quality_avg
  FROM public.demand_customer_ratings r
  INNER JOIN public.demands d ON d.id = r.demand_id
  WHERE d.assigned_specialist_id = p_profile_id;

  UPDATE public.installer_profiles ip
  SET
    customer_rating = COALESCE(v_customer_avg, 0),
    quality_score = COALESCE(v_quality_avg, 0),
    updated_at = now()
  WHERE ip.personnel_id = v_personnel_id;
END;
$$;

-- Submit or update rating (VIN + demand_number verification).
CREATE OR REPLACE FUNCTION public.customer_portal_rate_specialist(
  p_vin_query text,
  p_demand_number text,
  p_customer_rating integer,
  p_quality_score integer
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
BEGIN
  IF p_customer_rating IS NULL OR p_customer_rating < 1 OR p_customer_rating > 5
     OR p_quality_score IS NULL OR p_quality_score < 1 OR p_quality_score > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ratings must be between 1 and 5.');
  END IF;

  v_demand_number := NULLIF(trim(COALESCE(p_demand_number, '')), '');
  IF v_demand_number IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Demand reference is required.');
  END IF;

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

  INSERT INTO public.demand_customer_ratings (demand_id, customer_rating, quality_score)
  VALUES (v_demand_id, p_customer_rating, p_quality_score)
  ON CONFLICT (demand_id) DO UPDATE
  SET
    customer_rating = EXCLUDED.customer_rating,
    quality_score = EXCLUDED.quality_score,
    updated_at = now();

  PERFORM public.refresh_installer_scores_from_customer_ratings(v_specialist_id);

  RETURN jsonb_build_object(
    'ok', true,
    'customer_rating', p_customer_rating,
    'quality_score', p_quality_score
  );
END;
$$;

COMMENT ON FUNCTION public.customer_portal_rate_specialist(text, text, integer, integer)
  IS 'Customer portal: rate specialist for a completed demand (VIN + demand_number). Updates installer profile averages.';

GRANT EXECUTE ON FUNCTION public.customer_portal_rate_specialist(text, text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_rate_specialist(text, text, integer, integer) TO authenticated;

-- Extend VIN lookup with specialist + existing ratings.
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
  can_rate boolean
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
    )::boolean AS can_rate
  FROM public.demands d
  CROSS JOIN vin_key vk
  LEFT JOIN public.dealers dr ON dr.id = d.dealer_id
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
  IS 'Returns limited installation/warranty rows for anon customer portal VIN lookup (matched on last 6 of normalized VIN).';

GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO anon;
GRANT EXECUTE ON FUNCTION public.customer_portal_lookup_by_vin(text) TO authenticated;
