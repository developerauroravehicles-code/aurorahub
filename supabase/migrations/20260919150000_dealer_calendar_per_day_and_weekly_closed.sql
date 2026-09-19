-- Per-weekday dealer hours (Mon–Fri) + recurring weekly closed days

ALTER TABLE dealer_calendar_settings DROP CONSTRAINT IF EXISTS dealer_calendar_settings_day_type_check;
ALTER TABLE dealer_calendar_settings ADD CONSTRAINT dealer_calendar_settings_day_type_check
  CHECK (day_type IN (
    'weekday', 'mon', 'tue', 'wed', 'thu', 'fri', 'saturday', 'sunday'
  ));

INSERT INTO dealer_calendar_settings (dealer_id, day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes)
SELECT dealer_id, 'mon', start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes
FROM dealer_calendar_settings WHERE day_type = 'weekday'
ON CONFLICT (dealer_id, day_type) DO NOTHING;

INSERT INTO dealer_calendar_settings (dealer_id, day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes)
SELECT dealer_id, 'tue', start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes
FROM dealer_calendar_settings WHERE day_type = 'weekday'
ON CONFLICT (dealer_id, day_type) DO NOTHING;

INSERT INTO dealer_calendar_settings (dealer_id, day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes)
SELECT dealer_id, 'wed', start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes
FROM dealer_calendar_settings WHERE day_type = 'weekday'
ON CONFLICT (dealer_id, day_type) DO NOTHING;

INSERT INTO dealer_calendar_settings (dealer_id, day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes)
SELECT dealer_id, 'thu', start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes
FROM dealer_calendar_settings WHERE day_type = 'weekday'
ON CONFLICT (dealer_id, day_type) DO NOTHING;

INSERT INTO dealer_calendar_settings (dealer_id, day_type, start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes)
SELECT dealer_id, 'fri', start_hour, end_hour, slot_interval_minutes, appointment_duration_minutes
FROM dealer_calendar_settings WHERE day_type = 'weekday'
ON CONFLICT (dealer_id, day_type) DO NOTHING;

DELETE FROM dealer_calendar_settings WHERE day_type = 'weekday';

ALTER TABLE dealer_calendar_settings DROP CONSTRAINT dealer_calendar_settings_day_type_check;
ALTER TABLE dealer_calendar_settings ADD CONSTRAINT dealer_calendar_settings_day_type_check
  CHECK (day_type IN ('mon', 'tue', 'wed', 'thu', 'fri', 'saturday', 'sunday'));

CREATE TABLE IF NOT EXISTS dealer_weekly_closed_days (
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  iso_dow smallint NOT NULL CHECK (iso_dow >= 1 AND iso_dow <= 7),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (dealer_id, iso_dow)
);

CREATE INDEX IF NOT EXISTS idx_dealer_weekly_closed_days_dealer ON dealer_weekly_closed_days(dealer_id);

ALTER TABLE dealer_weekly_closed_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dealer weekly closed days"
  ON dealer_weekly_closed_days FOR SELECT USING (true);

CREATE POLICY "Aurora Managers can manage dealer weekly closed days"
  ON dealer_weekly_closed_days FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager')
  );
