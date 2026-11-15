-- CRM prospects (potential dealers) + shared conversation notes.

CREATE TABLE IF NOT EXISTS public.crm_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  primary_contact_name text,
  primary_contact_email text,
  phone text,
  address text,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'qualified', 'won', 'lost')),
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  acquired_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acquired_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_prospects_status ON public.crm_prospects (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_prospects_name ON public.crm_prospects (lower(name));

COMMENT ON TABLE public.crm_prospects IS 'Potential dealer accounts before Configuration/Dealers onboarding.';

ALTER TABLE public.dealer_crm_notes
  ALTER COLUMN dealer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES public.crm_prospects(id) ON DELETE CASCADE;

ALTER TABLE public.dealer_crm_notes
  DROP CONSTRAINT IF EXISTS dealer_crm_notes_owner_check;

ALTER TABLE public.dealer_crm_notes
  ADD CONSTRAINT dealer_crm_notes_owner_check CHECK (
    (dealer_id IS NOT NULL AND prospect_id IS NULL)
    OR (dealer_id IS NULL AND prospect_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_dealer_crm_notes_prospect
  ON public.dealer_crm_notes (prospect_id, created_at DESC)
  WHERE prospect_id IS NOT NULL;

ALTER TABLE public.dealer_crm_note_reminders
  ALTER COLUMN dealer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES public.crm_prospects(id) ON DELETE CASCADE;

ALTER TABLE public.dealer_crm_note_reminders
  DROP CONSTRAINT IF EXISTS dealer_crm_note_reminders_owner_check;

ALTER TABLE public.dealer_crm_note_reminders
  ADD CONSTRAINT dealer_crm_note_reminders_owner_check CHECK (
    (dealer_id IS NOT NULL AND prospect_id IS NULL)
    OR (dealer_id IS NULL AND prospect_id IS NOT NULL)
  );

ALTER TABLE public.crm_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aurora_manager_all_crm_prospects" ON public.crm_prospects;
CREATE POLICY "aurora_manager_all_crm_prospects"
  ON public.crm_prospects FOR ALL
  TO authenticated
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