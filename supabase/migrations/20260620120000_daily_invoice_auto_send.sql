-- Auto-send tracking for daily dealer invoice batches + failure notification type.

ALTER TABLE public.dealer_daily_invoice_batches
  ADD COLUMN IF NOT EXISTS auto_send_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_send_error text;

COMMENT ON COLUMN public.dealer_daily_invoice_batches.auto_send_attempted_at IS
  'When the 08:30 PT auto-send cron last attempted this batch.';
COMMENT ON COLUMN public.dealer_daily_invoice_batches.auto_send_error IS
  'Last auto-send error message when delivery failed.';

ALTER TABLE public.comm_notifications DROP CONSTRAINT IF EXISTS comm_notifications_type_check;

ALTER TABLE public.comm_notifications ADD CONSTRAINT comm_notifications_type_check
  CHECK (type IN (
    'chat_message',
    'meet_invite',
    'meet_started',
    'mention',
    'sms_pending',
    'daily_invoice_review',
    'daily_invoice_send_failed'
  ));
