-- CRM: meeting time on notes + precise follow-up remind_at.

ALTER TABLE public.dealer_crm_notes
  ADD COLUMN IF NOT EXISTS meeting_at timestamptz;

COMMENT ON COLUMN public.dealer_crm_notes.meeting_at IS
  'Scheduled meeting with dealer (Pacific wall time stored as UTC). Drives follow-up reminders.';

ALTER TABLE public.dealer_crm_note_reminders
  ADD COLUMN IF NOT EXISTS remind_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_kind text;

COMMENT ON COLUMN public.dealer_crm_note_reminders.remind_at IS
  'Exact UTC time to send follow-up email (derived from meeting or custom).';
COMMENT ON COLUMN public.dealer_crm_note_reminders.follow_up_kind IS
  'before_1h | at_meeting | after_1h | after_1d | after_3d | custom | legacy_date';

UPDATE public.dealer_crm_note_reminders r
SET
  remind_at = (r.remind_on::timestamptz AT TIME ZONE 'America/Vancouver'),
  follow_up_kind = COALESCE(r.follow_up_kind, 'legacy_date')
WHERE r.remind_at IS NULL AND r.remind_on IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dealer_crm_reminders_pending_at
  ON public.dealer_crm_note_reminders (status, remind_at)
  WHERE status = 'pending';