-- Links barcode set templates to a camera_models row shown on dealer booking forms.
ALTER TABLE public.inventory_barcode_set_templates
  ADD COLUMN IF NOT EXISTS booking_camera_model_id uuid
  REFERENCES public.camera_models(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.inventory_barcode_set_templates.booking_camera_model_id IS
  'Catalog camera_models row for dealer booking (Set label). Synced from inventory set templates.';

CREATE INDEX IF NOT EXISTS idx_set_templates_booking_camera
  ON public.inventory_barcode_set_templates(booking_camera_model_id)
  WHERE booking_camera_model_id IS NOT NULL;
