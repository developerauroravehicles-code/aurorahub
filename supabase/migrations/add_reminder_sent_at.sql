-- Track when 4-hour reminder SMS was sent to prevent duplicates
ALTER TABLE demands ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_demands_reminder_sent_at ON demands(reminder_sent_at) WHERE reminder_sent_at IS NOT NULL;
