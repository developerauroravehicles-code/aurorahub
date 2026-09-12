-- Per-dealer camera display order for booking / demand forms
ALTER TABLE public.dealer_cameras
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.dealer_cameras.sort_order IS
  'Display order for this camera on dealer booking forms (lower = first).';

CREATE INDEX IF NOT EXISTS idx_dealer_cameras_dealer_sort
  ON public.dealer_cameras (dealer_id, sort_order);
