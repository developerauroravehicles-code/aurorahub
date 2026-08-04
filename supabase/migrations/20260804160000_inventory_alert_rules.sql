-- Custom inventory alert rules (Aurora Manager configurable).

CREATE TABLE IF NOT EXISTS public.inventory_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN (
    'qty_below',
    'qty_above',
    'days_cover_below',
    'qty_negative',
    'dealer_total_below'
  )),
  location_scope text NOT NULL DEFAULT 'any' CHECK (location_scope IN ('any', 'national', 'dealer', 'specific')),
  location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  camera_model_id uuid REFERENCES public.camera_models(id) ON DELETE SET NULL,
  threshold_value numeric NOT NULL DEFAULT 0 CHECK (threshold_value >= 0),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'info')),
  is_active boolean NOT NULL DEFAULT true,
  notify_in_app boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_alert_rules_specific_location CHECK (
    location_scope <> 'specific' OR location_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS inventory_alert_rules_active_idx
  ON public.inventory_alert_rules (is_active)
  WHERE is_active = true;

ALTER TABLE public.inventory_alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_alert_rules_am ON public.inventory_alert_rules;
CREATE POLICY inventory_alert_rules_am ON public.inventory_alert_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

COMMENT ON TABLE public.inventory_alert_rules IS 'User-defined inventory alert rules evaluated on dashboard/cron.';
