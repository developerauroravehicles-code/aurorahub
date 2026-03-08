-- Overlap check: one slot taken = blocked for ALL dealers (shared system)
-- When any dealer books a slot, no other dealer can book the same slot

CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS TRIGGER AS $$
DECLARE
  appointment_duration_minutes INTEGER := 75;
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  overlapping_count INTEGER;
BEGIN
  -- Skip overlap check for external demands
  IF COALESCE(NEW.is_external, false) = true THEN
    RETURN NEW;
  END IF;

  new_start := NEW.appointment_date;
  new_end := NEW.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL;

  -- Check overlap globally (across all dealers) - exclude external and cancelled
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
$$ LANGUAGE plpgsql;
