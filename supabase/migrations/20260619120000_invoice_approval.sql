-- Invoice approval for daily invoice review workflow.

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS invoice_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.demands.invoice_approved_at IS
  'When an aurora_manager approved this invoice for daily dealer send.';
COMMENT ON COLUMN public.demands.invoice_approved_by IS
  'Profile that approved the invoice.';
