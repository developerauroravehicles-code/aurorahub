-- RPC: Get completed demands for personnel in date range
-- Demands assigned to specialist (assigned_specialist_id) and completed
-- Date: (completed_at::date or updated_at::date) within period

CREATE OR REPLACE FUNCTION get_completed_demands_for_payroll(
  p_personnel_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  id uuid,
  demand_number text,
  completed_at timestamptz,
  updated_at timestamptz,
  customer_firstname text,
  customer_lastname text,
  vehicle_make text,
  vehicle_model text,
  completion_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_personnel_name text;
BEGIN
  -- personnel'dan profile_id veya full_name al
  SELECT per.profile_id, per.full_name INTO v_profile_id, v_personnel_name
  FROM personnel per WHERE per.id = p_personnel_id;

  -- if no profile_id, find specialist by full_name in profiles
  IF v_profile_id IS NULL AND v_personnel_name IS NOT NULL THEN
    SELECT p.id INTO v_profile_id
    FROM profiles p
    WHERE p.role = 'specialist'
      AND (p.full_name ILIKE '%' || split_part(trim(v_personnel_name), ' ', 1) || '%'
           OR p.full_name ILIKE '%' || v_personnel_name || '%')
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN;  -- no profile, return empty
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.demand_number,
    d.completed_at,
    d.updated_at,
    d.customer_firstname,
    d.customer_lastname,
    d.vehicle_make,
    d.vehicle_model,
    COALESCE(d.completed_at::date, d.updated_at::date) as completion_date
  FROM demands d
  WHERE d.assigned_specialist_id = v_profile_id
    AND d.status = 'completed'
    AND COALESCE(d.completed_at::date, d.updated_at::date) >= p_period_start
    AND COALESCE(d.completed_at::date, d.updated_at::date) <= p_period_end
  ORDER BY completion_date, d.id;
END;
$$;

-- RLS bypass for service role; authenticated users get result via SECURITY DEFINER
GRANT EXECUTE ON FUNCTION get_completed_demands_for_payroll TO authenticated;
GRANT EXECUTE ON FUNCTION get_completed_demands_for_payroll TO service_role;
