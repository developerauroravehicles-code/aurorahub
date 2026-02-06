-- Prevent overlapping appointments at database level
-- This ensures that no two appointments can overlap in time, even with concurrent requests
-- Also enforces 90-minute gap between appointments

-- Create a function to check for overlapping appointments and gap violations
CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS TRIGGER AS $$
DECLARE
  appointment_duration_minutes INTEGER := 75; -- 1 hour 15 minutes
  required_gap_minutes INTEGER := 90; -- 1.5 hours gap between appointments
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  existing_start TIMESTAMPTZ;
  existing_end TIMESTAMPTZ;
  gap_before INTERVAL;
  gap_after INTERVAL;
  violation_count INTEGER;
BEGIN
  -- Calculate the start and end times for the new appointment
  new_start := NEW.appointment_date;
  new_end := NEW.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL;
  
  -- Check for any overlapping appointments or gap violations
  SELECT COUNT(*)
  INTO violation_count
  FROM demands
  WHERE status != 'cancelled'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid) -- Exclude current row on update
    AND (
      -- Check for overlap: appointments overlap if new_start < existing_end AND new_end > existing_start
      (appointment_date < new_end AND (appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) > new_start)
      OR
      -- Check for gap violation: gap must be at least 90 minutes
      -- Gap before: existing_start - new_end must be >= 90 minutes OR < 0 (overlap)
      (appointment_date - new_end < (required_gap_minutes || ' minutes')::INTERVAL AND appointment_date - new_end >= '0 minutes'::INTERVAL)
      OR
      -- Gap after: new_start - existing_end must be >= 90 minutes OR < 0 (overlap)
      (new_start - (appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) < (required_gap_minutes || ' minutes')::INTERVAL AND new_start - (appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) >= '0 minutes'::INTERVAL)
    );
  
  -- If there's an overlap or gap violation, raise an error
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'This time slot is already booked or violates the 90-minute gap requirement. Please select another time.';
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

