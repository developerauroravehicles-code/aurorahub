-- End-of-day alert when daily invoice batches still have unapproved items.

ALTER TABLE public.dealer_daily_invoice_batches
  ADD COLUMN IF NOT EXISTS eod_missed_notified_at timestamptz;

COMMENT ON COLUMN public.dealer_daily_invoice_batches.eod_missed_notified_at IS
  'When Aurora Managers were notified (SMS/email/in-app) about unapproved invoices at end of PT day.';

ALTER TABLE public.comm_notifications DROP CONSTRAINT IF EXISTS comm_notifications_type_check;
ALTER TABLE public.comm_notifications ADD CONSTRAINT comm_notifications_type_check
  CHECK (type IN (
    'chat_message',
    'meet_invite',
    'meet_started',
    'mention',
    'sms_pending',
    'daily_invoice_review',
    'daily_invoice_send_failed',
    'daily_invoice_missed',
    'service_record_pending',
    'duplicate_stock_number'
  ));

ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_message_type_check;
ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_message_type_check
  CHECK (message_type IN (
    'appointment_created',
    'cancellation_notice',
    'rescheduling_notice',
    'four_hour_reminder',
    'twenty_four_hour_reminder',
    'customer_directory_manual',
    'service_appointment_scheduled',
    'service_record_pending',
    'daily_invoice_missed'
  ));
