-- Add city layer: Canada → Province → City → Inner region → Dealer

CREATE TABLE IF NOT EXISTS public.inventory_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES public.inventory_provinces(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_cities_province ON public.inventory_cities (province_id);

ALTER TABLE public.inventory_regions
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.inventory_cities(id) ON DELETE CASCADE;

-- Backfill: one default metro city per province for existing inner regions
INSERT INTO public.inventory_cities (province_id, code, name)
SELECT DISTINCT r.province_id, 'METRO', 'Metro Area'
FROM public.inventory_regions r
WHERE r.city_id IS NULL
  AND r.province_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_cities c
    WHERE c.province_id = r.province_id AND c.code = 'METRO'
  );

UPDATE public.inventory_regions r
SET city_id = c.id
FROM public.inventory_cities c
WHERE r.city_id IS NULL
  AND r.province_id IS NOT NULL
  AND c.province_id = r.province_id
  AND c.code = 'METRO';

-- New regions require city; keep province_id for legacy reads until dropped later
ALTER TABLE public.inventory_regions
  ALTER COLUMN city_id SET NOT NULL;

ALTER TABLE public.inventory_regions DROP CONSTRAINT IF EXISTS inventory_regions_province_id_code_key;
ALTER TABLE public.inventory_regions ADD CONSTRAINT inventory_regions_city_id_code_key UNIQUE (city_id, code);

ALTER TABLE public.inventory_locations
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.inventory_cities(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_locations DROP CONSTRAINT IF EXISTS inventory_locations_type_fk_check;
ALTER TABLE public.inventory_locations ADD CONSTRAINT inventory_locations_type_fk_check CHECK (
  (location_type = 'national' AND province_id IS NULL AND city_id IS NULL AND region_id IS NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
  OR (location_type = 'province' AND province_id IS NOT NULL AND city_id IS NULL AND region_id IS NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
  OR (location_type = 'city' AND city_id IS NOT NULL AND region_id IS NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
  OR (location_type = 'region' AND region_id IS NOT NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
  OR (location_type = 'dealer' AND dealer_id IS NOT NULL AND specialist_profile_id IS NULL)
  OR (location_type = 'specialist' AND specialist_profile_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_city_unique
  ON public.inventory_locations (city_id) WHERE location_type = 'city';

-- City stock locations for existing cities
INSERT INTO public.inventory_locations (location_type, city_id, province_id, label)
SELECT 'city', c.id, c.province_id, c.name || ' — City Stock'
FROM public.inventory_cities c
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_locations l WHERE l.location_type = 'city' AND l.city_id = c.id
);

CREATE OR REPLACE FUNCTION public.fn_ensure_inventory_city_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE location_type = 'city' AND city_id = NEW.id) THEN
    INSERT INTO public.inventory_locations (location_type, city_id, province_id, label)
    VALUES ('city', NEW.id, NEW.province_id, NEW.name || ' — City Stock');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_inventory_cities_location ON public.inventory_cities;
CREATE TRIGGER tr_inventory_cities_location
  AFTER INSERT ON public.inventory_cities
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ensure_inventory_city_location();

CREATE OR REPLACE FUNCTION public.fn_ensure_inventory_region_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_province_id uuid;
BEGIN
  SELECT province_id INTO v_province_id FROM public.inventory_cities WHERE id = NEW.city_id;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE location_type = 'region' AND region_id = NEW.id) THEN
    INSERT INTO public.inventory_locations (location_type, region_id, city_id, province_id, label)
    VALUES ('region', NEW.id, NEW.city_id, v_province_id, NEW.name || ' — Inner Region Stock');
  END IF;
  RETURN NEW;
END;
$$;

-- Pricing cascade: add city scope
ALTER TABLE public.inventory_pricing_rules DROP CONSTRAINT IF EXISTS inventory_pricing_rules_scope_type_check;
ALTER TABLE public.inventory_pricing_rules ADD CONSTRAINT inventory_pricing_rules_scope_type_check
  CHECK (scope_type IN ('national', 'province', 'city', 'region', 'dealer'));

ALTER TABLE public.inventory_locations DROP CONSTRAINT IF EXISTS inventory_locations_location_type_check;
ALTER TABLE public.inventory_locations ADD CONSTRAINT inventory_locations_location_type_check
  CHECK (location_type IN ('national', 'province', 'city', 'region', 'dealer', 'specialist'));

ALTER TABLE public.inventory_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_cities_am ON public.inventory_cities;
CREATE POLICY inventory_cities_am ON public.inventory_cities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

-- Optional BC starter geography (Vancouver + inner regions from operational map)
DO $$
DECLARE
  v_bc uuid;
  v_van uuid;
BEGIN
  SELECT id INTO v_bc FROM public.inventory_provinces WHERE code = 'BC' LIMIT 1;
  IF v_bc IS NULL THEN RETURN; END IF;

  INSERT INTO public.inventory_cities (province_id, code, name)
  VALUES (v_bc, 'VAN', 'Vancouver')
  ON CONFLICT (province_id, code) DO NOTHING;

  SELECT id INTO v_van FROM public.inventory_cities WHERE province_id = v_bc AND code = 'VAN' LIMIT 1;
  IF v_van IS NULL THEN RETURN; END IF;

  INSERT INTO public.inventory_regions (city_id, province_id, code, name) VALUES
    (v_van, v_bc, 'EAST', 'East Vancouver'),
    (v_van, v_bc, 'WEST', 'West End'),
    (v_van, v_bc, 'KITS', 'Kitsilano'),
    (v_van, v_bc, 'MTPL', 'Mount Pleasant'),
    (v_van, v_bc, 'MARP', 'Marpole'),
    (v_van, v_bc, 'KERR', 'Kerrisdale'),
    (v_van, v_bc, 'HAST', 'Hastings-Sunrise'),
    (v_van, v_bc, 'RENF', 'Renfrew-Collingwood')
  ON CONFLICT (city_id, code) DO NOTHING;
END $$;
