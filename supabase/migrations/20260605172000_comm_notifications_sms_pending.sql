-- Add 'sms_pending' notification type to comm_notifications.
-- Used when a demand has SMS templates that haven't been sent yet.

ALTER TABLE comm_notifications DROP CONSTRAINT IF EXISTS comm_notifications_type_check;

ALTER TABLE comm_notifications ADD CONSTRAINT comm_notifications_type_check
  CHECK (type IN ('chat_message', 'meet_invite', 'meet_started', 'mention', 'sms_pending'));
