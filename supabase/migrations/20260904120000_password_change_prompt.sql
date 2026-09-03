-- Password change prompt: 6-month cycle, one-time email tokens.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_last_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_password_prompt_at timestamptz;

COMMENT ON COLUMN public.profiles.password_last_changed_at IS
  'Last successful password change (self-service or admin reset).';
COMMENT ON COLUMN public.profiles.next_password_prompt_at IS
  'When to show the password change prompt next; null falls back to interval from last change or created_at.';

CREATE TABLE IF NOT EXISTS public.password_change_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_change_tokens_hash
  ON public.password_change_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_change_tokens_user_id
  ON public.password_change_tokens(user_id, created_at DESC);

ALTER TABLE public.password_change_tokens ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: server actions use service role only.

INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
  'password_prompt_settings',
  '{"intervalDays":180,"tokenTtlHours":24,"supportEmail":"support@auroravehicles.com","supportPhone":""}',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- First dashboard visit after deploy: show prompt once for existing users.
UPDATE public.profiles
SET next_password_prompt_at = now()
WHERE next_password_prompt_at IS NULL;
