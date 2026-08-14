-- SMS lifecycle dedup columns, delivery status tracking, new message types.

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS post_completion_portal_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_completion_custom_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sd_card_warranty_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dashcam_warranty_sms_sent_at timestamptz;

COMMENT ON COLUMN public.demands.post_completion_portal_sms_sent_at IS 'When post-completion portal thank-you SMS was sent.';
COMMENT ON COLUMN public.demands.post_completion_custom_sms_sent_at IS 'When configurable post-completion SMS was sent.';
COMMENT ON COLUMN public.demands.sd_card_warranty_sms_sent_at IS 'When SD card warranty expiry SMS was sent.';
COMMENT ON COLUMN public.demands.dashcam_warranty_sms_sent_at IS 'When dashcam warranty expiry SMS was sent.';

ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS twilio_sid text;

ALTER TABLE public.sms_logs
  DROP CONSTRAINT IF EXISTS sms_logs_delivery_status_check;

ALTER TABLE public.sms_logs
  ADD CONSTRAINT sms_logs_delivery_status_check
  CHECK (delivery_status IN ('sent', 'failed'));

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
    'daily_invoice_missed',
    'post_completion_portal',
    'post_completion_custom',
    'sd_card_warranty_expired',
    'dashcam_warranty_expired'
  ));

DROP FUNCTION IF EXISTS public.customer_directory_summaries();

CREATE OR REPLACE FUNCTION public.customer_directory_summaries()
RETURNS TABLE (
  phone_key text,
  customer_phone text,
  customer_firstname text,
  customer_lastname text,
  demand_count bigint,
  last_activity timestamptz,
  latest_camera_model text,
  latest_dealer_name text,
  latest_warranty_end date,
  last_sms_at timestamptz,
  last_sms_body text,
  last_sms_status text,
  last_sms_error text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered_demands AS (
    SELECT
      regexp_replace(trim(COALESCE(d.customer_phone, '')), '\D', '', 'g') AS phone_key,
      d.customer_phone,
      d.customer_firstname,
      d.customer_lastname,
      d.updated_at,
      d.created_at,
      d.camera_model,
      d.status,
      d.completed_at,
      dr.name AS dealer_name,
      dr.warranty_years AS dealer_warranty_years
    FROM demands d
    LEFT JOIN dealers dr ON dr.id = d.dealer_id
    WHERE length(regexp_replace(trim(COALESCE(d.customer_phone, '')), '\D', '', 'g')) > 0
  ),
  latest_per_phone AS (
    SELECT DISTINCT ON (fd.phone_key)
      fd.phone_key,
      fd.customer_phone,
      fd.customer_firstname,
      fd.customer_lastname,
      fd.camera_model,
      fd.dealer_name,
      fd.dealer_warranty_years,
      fd.status,
      fd.completed_at,
      fd.updated_at
    FROM filtered_demands fd
    ORDER BY fd.phone_key, GREATEST(fd.updated_at, fd.created_at) DESC
  ),
  counts AS (
    SELECT fd.phone_key, count(*)::bigint AS demand_count
    FROM filtered_demands fd
    GROUP BY fd.phone_key
  ),
  last_act AS (
    SELECT fd.phone_key, max(GREATEST(fd.updated_at, fd.created_at)) AS last_activity
    FROM filtered_demands fd
    GROUP BY fd.phone_key
  ),
  last_sms AS (
    SELECT DISTINCT ON (regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g'))
      regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g') AS phone_key,
      sl.sent_at AS last_sms_at,
      sl.message_content AS last_sms_body,
      sl.delivery_status AS last_sms_status,
      sl.error_message AS last_sms_error
    FROM sms_logs sl
    WHERE sl.recipient_type = 'customer'
      AND length(regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g')) > 0
    ORDER BY regexp_replace(trim(COALESCE(sl.phone_number, '')), '\D', '', 'g'), sl.sent_at DESC
  )
  SELECT
    l.phone_key,
    l.customer_phone::text,
    l.customer_firstname::text,
    l.customer_lastname::text,
    c.demand_count,
    la.last_activity,
    COALESCE(l.camera_model, '')::text AS latest_camera_model,
    COALESCE(l.dealer_name, '')::text AS latest_dealer_name,
    CASE
      WHEN (l.status)::text = 'completed'
        AND COALESCE(l.completed_at, l.updated_at) IS NOT NULL
      THEN (
        COALESCE(l.completed_at, l.updated_at)::date
        + (COALESCE(l.dealer_warranty_years, 3) || ' years')::interval
      )::date
      ELSE NULL
    END AS latest_warranty_end,
    ls.last_sms_at,
    ls.last_sms_body,
    ls.last_sms_status,
    ls.last_sms_error
  FROM latest_per_phone l
  INNER JOIN counts c USING (phone_key)
  INNER JOIN last_act la USING (phone_key)
  LEFT JOIN last_sms ls USING (phone_key)
  ORDER BY la.last_activity DESC NULLS LAST;
$$;
