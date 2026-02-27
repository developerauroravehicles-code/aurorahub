-- Mail logs table for tracking sent emails (reports, notifications, etc.)
CREATE TABLE IF NOT EXISTS mail_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz DEFAULT now(),
  recipient_emails text[] NOT NULL,
  subject text NOT NULL,
  mail_type text NOT NULL, -- 'report', 'scheduled_report', 'low_stock_alert', 'camera_dealer_notify', etc.
  report_title text,
  sender_id uuid REFERENCES profiles(id),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE mail_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aurora Managers can view mail logs"
ON mail_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

-- Inserts use createAdminClient (service role) which bypasses RLS.
