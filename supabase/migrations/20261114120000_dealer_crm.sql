-- Aurora Manager CRM: dealer acquisition tracking, notes, email reminders.

ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS acquired_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acquired_at timestamptz,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text;

COMMENT ON COLUMN public.dealers.acquired_by_profile_id IS 'Internal user who brought the dealer account (immutable once set).';
COMMENT ON COLUMN public.dealers.acquired_at IS 'When the dealer account was linked (immutable once set).';

CREATE OR REPLACE FUNCTION public.dealers_prevent_acquired_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.acquired_by_profile_id IS NOT NULL THEN
    IF NEW.acquired_by_profile_id IS DISTINCT FROM OLD.acquired_by_profile_id
       OR NEW.acquired_at IS DISTINCT FROM OLD.acquired_at THEN
      RAISE EXCEPTION 'dealer acquired_by and acquired_at cannot be changed once set';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dealers_prevent_acquired_change ON public.dealers;
CREATE TRIGGER tr_dealers_prevent_acquired_change
  BEFORE UPDATE ON public.dealers
  FOR EACH ROW
  EXECUTE FUNCTION public.dealers_prevent_acquired_change();

CREATE TABLE IF NOT EXISTS public.dealer_crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealer_crm_notes_dealer
  ON public.dealer_crm_notes (dealer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dealer_crm_note_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.dealer_crm_notes(id) ON DELETE CASCADE,
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  remind_on date NOT NULL,
  recipient_email text NOT NULL CHECK (recipient_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  last_error text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealer_crm_reminders_pending
  ON public.dealer_crm_note_reminders (status, remind_on)
  WHERE status = 'pending';

ALTER TABLE public.dealer_crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_crm_note_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aurora_manager_all_dealer_crm_notes" ON public.dealer_crm_notes;
CREATE POLICY "aurora_manager_all_dealer_crm_notes"
  ON public.dealer_crm_notes FOR ALL
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

DROP POLICY IF EXISTS "aurora_manager_all_dealer_crm_reminders" ON public.dealer_crm_note_reminders;
CREATE POLICY "aurora_manager_all_dealer_crm_reminders"
  ON public.dealer_crm_note_reminders FOR ALL
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