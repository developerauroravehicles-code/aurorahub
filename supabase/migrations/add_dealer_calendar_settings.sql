-- Create dealer_calendar_settings table for dealer-specific calendar configurations
CREATE TABLE IF NOT EXISTS dealer_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  day_type text NOT NULL CHECK (day_type IN ('weekday', 'weekend')),
  start_hour int NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour int NOT NULL CHECK (end_hour >= 0 AND end_hour <= 23),
  slot_interval_minutes int NOT NULL DEFAULT 90 CHECK (slot_interval_minutes > 0),
  appointment_duration_minutes int NOT NULL DEFAULT 75 CHECK (appointment_duration_minutes > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dealer_id, day_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dealer_calendar_settings_dealer_id ON dealer_calendar_settings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_calendar_settings_day_type ON dealer_calendar_settings(day_type);

-- RLS Policies
ALTER TABLE dealer_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view calendar settings
CREATE POLICY "Anyone can view dealer calendar settings"
  ON dealer_calendar_settings
  FOR SELECT
  USING (true);

-- Only Aurora Managers can manage calendar settings
CREATE POLICY "Aurora Managers can manage dealer calendar settings"
  ON dealer_calendar_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_dealer_calendar_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dealer_calendar_settings_updated_at
  BEFORE UPDATE ON dealer_calendar_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_dealer_calendar_settings_updated_at();

