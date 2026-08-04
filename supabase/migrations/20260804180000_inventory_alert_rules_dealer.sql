-- Single-dealer scope for custom inventory alert rules.

ALTER TABLE public.inventory_alert_rules
  ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_alert_rules DROP CONSTRAINT IF EXISTS inventory_alert_rules_location_scope_check;

ALTER TABLE public.inventory_alert_rules ADD CONSTRAINT inventory_alert_rules_location_scope_check
  CHECK (location_scope IN ('any', 'national', 'dealer', 'province', 'city', 'region', 'dealer_one'));

ALTER TABLE public.inventory_alert_rules ADD CONSTRAINT inventory_alert_rules_dealer_one CHECK (
  location_scope <> 'dealer_one' OR dealer_id IS NOT NULL
);
