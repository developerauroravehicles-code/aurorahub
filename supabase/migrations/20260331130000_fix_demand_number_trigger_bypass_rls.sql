-- Demand number + overlap triggers read public.demands. RLS limits sales/finance to
-- their dealer only, so MAX(demand_number) was computed over a subset → duplicate
-- demands_demand_number_key when another dealer already used that sequence value.
-- Run trigger logic as definer so allocation / overlap checks see all rows.

CREATE OR REPLACE FUNCTION public.generate_demand_number_arr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_year int;
  n_next int;
  n_number text;
BEGIN
  IF NEW.demand_number IS NOT NULL AND TRIM(NEW.demand_number) != '' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('demand_number_arr'));

  n_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, NOW()));
  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(demand_number, '^ARR[0-9]{4}', ''), '')::int
  ), 0) + 1 INTO n_next
  FROM demands
  WHERE demand_number LIKE 'ARR' || n_year::text || '%';

  n_number := 'ARR' || n_year::text || LPAD(n_next::text, 7, '0');
  NEW.demand_number := n_number;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_demand_number_arr() IS
  'SECURITY DEFINER: next ARR demand number must use global MAX, not RLS-scoped rows.';

CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_duration_minutes INTEGER := 75;
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  overlapping_count INTEGER;
BEGIN
  IF COALESCE(NEW.is_external, false) = true THEN
    RETURN NEW;
  END IF;

  new_start := NEW.appointment_date;
  new_end := NEW.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL;

  SELECT COUNT(*)
  INTO overlapping_count
  FROM demands
  WHERE status != 'cancelled'
    AND COALESCE(is_external, false) = false
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND appointment_date < new_end
    AND (appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) > new_start;

  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'This time slot is already booked. Please select another time.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_appointment_overlap() IS
  'SECURITY DEFINER: overlap must be enforced across all dealers, not RLS-visible subset.';
