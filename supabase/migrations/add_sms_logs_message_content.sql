-- Add message_content column to sms_logs for viewing sent SMS content
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS message_content text;
