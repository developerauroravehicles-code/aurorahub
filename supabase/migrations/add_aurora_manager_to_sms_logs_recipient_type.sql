-- Allow aurora_manager as recipient_type in sms_logs
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_recipient_type_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_recipient_type_check
  CHECK (recipient_type IN ('customer', 'specialist', 'aurora_manager'));
