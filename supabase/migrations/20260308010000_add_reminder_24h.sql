-- Track when 24-hour reminder SMS was sent (alongside reminder_sent_at for 4h reminder)
ALTER TABLE demands ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_demands_reminder_24h_sent_at ON demands(reminder_24h_sent_at) WHERE reminder_24h_sent_at IS NOT NULL;

-- Add twenty_four_hour_reminder to sms_logs message_type
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_message_type_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_message_type_check
  CHECK (message_type IN ('appointment_created', 'cancellation_notice', 'rescheduling_notice', 'four_hour_reminder', 'twenty_four_hour_reminder'));
