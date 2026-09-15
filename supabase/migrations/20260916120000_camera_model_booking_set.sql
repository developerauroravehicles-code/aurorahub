-- Booking UI: label some catalog models as "Set" on dealer demand forms
ALTER TABLE public.camera_models
  ADD COLUMN IF NOT EXISTS booking_display_as_set boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.camera_models.booking_display_as_set IS
  'When true, dealer booking dropdown shows this model with a Set prefix.';
