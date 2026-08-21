-- HR termination + IT login disable support

ALTER TYPE personnel_status ADD VALUE IF NOT EXISTS 'terminated';

ALTER TYPE personnel_event_type ADD VALUE IF NOT EXISTS 'terminated';

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS termination_reason text;

COMMENT ON COLUMN public.personnel.end_date IS 'Last day of employment (HR termination).';
COMMENT ON COLUMN public.personnel.termination_reason IS 'Optional reason recorded when HR ends employment.';

-- Extend identity audit event types
ALTER TABLE public.identity_audit_log
  DROP CONSTRAINT IF EXISTS identity_audit_log_event_type_check;

ALTER TABLE public.identity_audit_log
  ADD CONSTRAINT identity_audit_log_event_type_check
  CHECK (event_type IN (
    'login_success',
    'login_failed',
    'logout',
    'password_reset',
    'role_change',
    'account_disabled',
    'account_enabled'
  ));
