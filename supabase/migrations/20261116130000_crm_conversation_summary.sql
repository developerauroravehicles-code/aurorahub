-- Main conversation text (top) separate from comment notes.

ALTER TABLE public.crm_prospects
  ADD COLUMN IF NOT EXISTS summary text;

COMMENT ON COLUMN public.crm_prospects.summary IS 'Primary conversation narrative shown at top of CRM record.';

ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS crm_summary text;

COMMENT ON COLUMN public.dealers.crm_summary IS 'Primary CRM conversation narrative for live dealers.';