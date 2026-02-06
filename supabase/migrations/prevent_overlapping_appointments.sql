-- Prevent overlapping appointments at database level
-- This ensures that no two appointments can overlap in time, even with concurrent requests

-- Create a function to check for overlapping appointments
CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS TRIGGER AS $$
DECLARE
  appointment_duration_minutes INTEGER := 75; -- 1 hour 15 minutes
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  existing_start TIMESTAMPTZ;
  existing_end TIMESTAMPTZ;
  overlapping_count INTEGER;
BEGIN
  -- Calculate the start and end times for the new appointment
  new_start := NEW.appointment_date;
  new_end := NEW.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL;
  
  -- Check for any overlapping appointments (excluding cancelled ones and the current row if updating)
  SELECT COUNT(*)
  INTO overlapping_count
  FROM demands
  WHERE status != 'cancelled'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid) -- Exclude current row on update
    AND appointment_date < new_end
    AND (appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) > new_start;
  
  -- If there's an overlap, raise an error
  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'This time slot is already booked. Please select another time.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check overlap before insert or update
DROP TRIGGER IF EXISTS prevent_overlapping_appointments_trigger ON demands;
CREATE TRIGGER prevent_overlapping_appointments_trigger
  BEFORE INSERT OR UPDATE OF appointment_date, status ON demands
  FOR EACH ROW
  WHEN (NEW.status != 'cancelled') -- Only check for non-cancelled appointments
  EXECUTE FUNCTION check_appointment_overlap();

-- Add index for better performance on appointment_date queries
CREATE INDEX IF NOT EXISTS idx_demands_appointment_date_status 
ON demands(appointment_date, status) 
WHERE status != 'cancelled';

