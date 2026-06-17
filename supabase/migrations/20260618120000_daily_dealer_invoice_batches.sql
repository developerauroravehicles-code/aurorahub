-- Daily dealer invoice batches, dealer invoice emails, and notification type.

-- 1. Dealer invoice email recipients
CREATE TABLE IF NOT EXISTS public.dealer_invoice_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  email text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dealer_invoice_emails_dealer_email_unique
  ON public.dealer_invoice_emails (dealer_id, lower(trim(email)));

COMMENT ON TABLE public.dealer_invoice_emails IS
  'Email addresses that receive daily invoice PDF bundles for a dealer.';

-- 2. Daily batch per dealer per PT calendar date
CREATE TABLE IF NOT EXISTS public.dealer_daily_invoice_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  batch_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sent')),
  review_notified_at timestamptz,
  sent_at timestamptz,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, batch_date)
);

COMMENT ON TABLE public.dealer_daily_invoice_batches IS
  'One batch per dealer per Pacific Time calendar day for daily invoice review and send.';

-- 3. Batch line items (one demand per batch max)
CREATE TABLE IF NOT EXISTS public.dealer_daily_invoice_batch_items (
  batch_id uuid NOT NULL REFERENCES public.dealer_daily_invoice_batches(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  included boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, demand_id),
  UNIQUE (demand_id)
);

COMMENT ON TABLE public.dealer_daily_invoice_batch_items IS
  'Links completed demands to a daily dealer batch. Amounts live on demands.invoice_* columns.';

CREATE INDEX IF NOT EXISTS idx_daily_invoice_batches_date
  ON public.dealer_daily_invoice_batches (batch_date);

CREATE INDEX IF NOT EXISTS idx_daily_invoice_batch_items_batch
  ON public.dealer_daily_invoice_batch_items (batch_id);

-- 4. RLS
ALTER TABLE public.dealer_invoice_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_daily_invoice_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_daily_invoice_batch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_roles_all_dealer_invoice_emails" ON public.dealer_invoice_emails;
CREATE POLICY "admin_roles_all_dealer_invoice_emails"
  ON public.dealer_invoice_emails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('aurora_manager', 'it')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('aurora_manager', 'it')
    )
  );

DROP POLICY IF EXISTS "aurora_manager_all_daily_invoice_batches" ON public.dealer_daily_invoice_batches;
CREATE POLICY "aurora_manager_all_daily_invoice_batches"
  ON public.dealer_daily_invoice_batches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'aurora_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'aurora_manager'
    )
  );

DROP POLICY IF EXISTS "aurora_manager_all_daily_invoice_batch_items" ON public.dealer_daily_invoice_batch_items;
CREATE POLICY "aurora_manager_all_daily_invoice_batch_items"
  ON public.dealer_daily_invoice_batch_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'aurora_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'aurora_manager'
    )
  );

-- Realtime for live batch updates on Daily Invoices page
ALTER TABLE public.dealer_daily_invoice_batch_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dealer_daily_invoice_batch_items;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Notification type for 21:00 PT daily review
ALTER TABLE public.comm_notifications DROP CONSTRAINT IF EXISTS comm_notifications_type_check;

ALTER TABLE public.comm_notifications ADD CONSTRAINT comm_notifications_type_check
  CHECK (type IN (
    'chat_message',
    'meet_invite',
    'meet_started',
    'mention',
    'sms_pending',
    'daily_invoice_review'
  ));
