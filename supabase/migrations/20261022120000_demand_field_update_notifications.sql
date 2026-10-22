-- Field-level demand edits: metadata on demand_logs + in-app notifications

ALTER TABLE public.demand_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.demand_logs.metadata IS
  'Optional JSON: field_changes[], actor_role for demand detail highlights and notifications';

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
    'duplicate_stock_number',
    'inventory_stock_alert',
    'demand_fields_updated'
  ));
