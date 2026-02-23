-- Split weekend into Saturday and Sunday for dealer calendar settings
-- 1. Expand day_type to include saturday and sunday (keep weekend for migration)
ALTER TABLE dealer_calendar_settings DROP CONSTRAINT IF EXISTS dealer_calendar_settings_day_type_check;
ALTER TABLE dealer_calendar_settings ADD CONSTRAINT dealer_calendar_settings_day_type_check
  CHECK (day_type IN ('weekday', 'weekend', 'saturday', 'sunday'));

-- 2. Migrate existing weekend settings to saturday and sunday
INSERT INTO dealer_calendar_settings (dealer_id, day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes)
SELECT dealer_id, 'saturday', start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes
FROM dealer_calendar_settings
WHERE day_type = 'weekend'
ON CONFLICT (dealer_id, day_type) DO NOTHING;

INSERT INTO dealer_calendar_settings (dealer_id, day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes)
SELECT dealer_id, 'sunday', start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes
FROM dealer_calendar_settings
WHERE day_type = 'weekend'
ON CONFLICT (dealer_id, day_type) DO NOTHING;

-- 3. Delete old weekend rows
DELETE FROM dealer_calendar_settings WHERE day_type = 'weekend';

-- 4. Update constraint to only allow weekday, saturday, sunday
ALTER TABLE dealer_calendar_settings DROP CONSTRAINT dealer_calendar_settings_day_type_check;
ALTER TABLE dealer_calendar_settings ADD CONSTRAINT dealer_calendar_settings_day_type_check
  CHECK (day_type IN ('weekday', 'saturday', 'sunday'));
