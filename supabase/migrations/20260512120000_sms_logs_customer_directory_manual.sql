-- Allow customer-directory manual SMS in sms_logs
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_message_type_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_message_type_check
  CHECK (message_type IN (
    'appointment_created',
    'cancellation_notice',
    'rescheduling_notice',
    'four_hour_reminder',
    'twenty_four_hour_reminder',
    'customer_directory_manual'
  ));
