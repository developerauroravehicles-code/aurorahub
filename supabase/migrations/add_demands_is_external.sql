-- Add is_external to demands: external demands do not affect calendar slots
ALTER TABLE demands ADD COLUMN IF NOT EXISTS is_external boolean DEFAULT false;

-- Update overlap trigger to exclude external demands
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

  -- Exclude external demands and cancelled; exclude current row on update
  -- Overlap check is per dealer (same as isTimeSlotTaken)
  SELECT COUNT(*)
  INTO overlapping_count
  FROM demands
  WHERE status != 'cancelled'
    AND COALESCE(is_external, false) = false
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND dealer_id IS NOT DISTINCT FROM NEW.dealer_id
    AND appointment_date < new_end
    AND (appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) > new_start;

  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'This time slot is already booked. Please select another time.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
