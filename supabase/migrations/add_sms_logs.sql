-- SMS logs table for tracking sent messages
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz NOT NULL DEFAULT now(),
  phone_number text NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('customer', 'specialist')),
  recipient_name text,
  demand_id uuid REFERENCES demands(id) ON DELETE SET NULL,
  message_type text NOT NULL CHECK (message_type IN ('appointment_created', 'cancellation_notice', 'rescheduling_notice', 'four_hour_reminder')),
  triggered_by text NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('system', 'manual')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_sms_logs_demand_id ON sms_logs(demand_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_name ON sms_logs(recipient_name);
CREATE INDEX IF NOT EXISTS idx_sms_logs_message_type ON sms_logs(message_type);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aurora Managers can view sms_logs"
  ON sms_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  );

CREATE POLICY "Authenticated users can insert sms_logs"
  ON sms_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
