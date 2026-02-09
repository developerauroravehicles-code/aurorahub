-- Dealer-based calendar blocks: close specific days or time slots per dealer
CREATE TABLE IF NOT EXISTS dealer_calendar_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  start_minutes int NOT NULL DEFAULT 0 CHECK (start_minutes >= 0 AND start_minutes <= 1440),
  end_minutes int NOT NULL DEFAULT 1440 CHECK (end_minutes >= 0 AND end_minutes <= 1440),
  CONSTRAINT block_minutes_order CHECK (start_minutes < end_minutes),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealer_calendar_blocks_dealer_date ON dealer_calendar_blocks(dealer_id, block_date);

ALTER TABLE dealer_calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dealer calendar blocks"
  ON dealer_calendar_blocks FOR SELECT USING (true);

CREATE POLICY "Aurora Managers can manage dealer calendar blocks"
  ON dealer_calendar_blocks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'aurora_manager')
  );
