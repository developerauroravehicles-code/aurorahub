-- Patch pool-scoped overlap trigger to skip is_individual (same as is_external).
-- Run after 20261119180000. Retry once if deadlock (40P01) — avoid running during heavy traffic.

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
  pool_id uuid;
  pool_capacity INTEGER;
  overlapping_count INTEGER;
BEGIN
  IF COALESCE(NEW.is_external, false) = true OR COALESCE(NEW.is_individual, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.dealer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT scheduling_pool_id INTO pool_id FROM dealers WHERE id = NEW.dealer_id;

  IF pool_id IS NULL THEN
    SELECT id INTO pool_id FROM scheduling_pools WHERE code = 'DEFAULT' LIMIT 1;
    IF pool_id IS NOT NULL THEN
      UPDATE dealers SET scheduling_pool_id = pool_id WHERE id = NEW.dealer_id;
    END IF;
  END IF;

  IF pool_id IS NULL THEN
    RETURN NEW;
  END IF;

  pool_capacity := public.get_scheduling_pool_capacity(pool_id);
  new_start := NEW.appointment_date;
  new_end := NEW.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL;

  SELECT COUNT(*)
  INTO overlapping_count
  FROM demands d
  JOIN dealers dl ON dl.id = d.dealer_id
  WHERE d.status != 'cancelled'
    AND COALESCE(d.is_external, false) = false
    AND COALESCE(d.is_individual, false) = false
    AND dl.scheduling_pool_id = pool_id
    AND d.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND d.appointment_date < new_end
    AND (d.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) > new_start;

  IF overlapping_count >= pool_capacity THEN
    RAISE EXCEPTION 'This time slot is fully booked for your service area. Please select another time.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_appointment_overlap() IS
  'Pool-scoped overlap; skips external and individual demands.';