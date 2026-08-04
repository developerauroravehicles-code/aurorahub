-- Geographic hierarchy for custom inventory alert rules (Canada → province → city → region).

ALTER TABLE public.inventory_alert_rules
  ADD COLUMN IF NOT EXISTS province_id uuid REFERENCES public.inventory_provinces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.inventory_cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.inventory_regions(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_alert_rules DROP CONSTRAINT IF EXISTS inventory_alert_rules_specific_location;
ALTER TABLE public.inventory_alert_rules DROP CONSTRAINT IF EXISTS inventory_alert_rules_location_scope_check;

UPDATE public.inventory_alert_rules SET location_scope = 'any' WHERE location_scope = 'specific';

ALTER TABLE public.inventory_alert_rules ADD CONSTRAINT inventory_alert_rules_location_scope_check
  CHECK (location_scope IN ('any', 'national', 'dealer', 'province', 'city', 'region'));

ALTER TABLE public.inventory_alert_rules ADD CONSTRAINT inventory_alert_rules_geo_province CHECK (
  location_scope <> 'province' OR province_id IS NOT NULL
);

ALTER TABLE public.inventory_alert_rules ADD CONSTRAINT inventory_alert_rules_geo_city CHECK (
  location_scope <> 'city' OR city_id IS NOT NULL
);

ALTER TABLE public.inventory_alert_rules ADD CONSTRAINT inventory_alert_rules_geo_region CHECK (
  location_scope <> 'region' OR region_id IS NOT NULL
);
