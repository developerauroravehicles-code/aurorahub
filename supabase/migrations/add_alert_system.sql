-- Alerts system: rules config + logs for deduplication
-- Alerts are sent to IT and Aurora Manager users via email when problematic situations occur.
-- Triggered by cron (/api/run-alerts).

-- ============================================
-- 1. ALERT LOGS (deduplication + history)
-- ============================================
CREATE TABLE IF NOT EXISTS alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  subject text,
  recipient_count int,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_type_entity ON alert_logs(alert_type, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_created ON alert_logs(created_at DESC);

ALTER TABLE alert_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aurora Managers and IT can view alert logs"
  ON alert_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('aurora_manager', 'it')
    )
  );

-- Inserts from service role (API) bypass RLS.
