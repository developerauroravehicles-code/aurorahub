-- Inventory v2: hierarchical stock (national → province → region → dealer → specialist) + cascade pricing.

-- ---------------------------------------------------------------------------
-- 1. Tear down legacy inventory + consumption trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_demands_inventory_consumption ON public.demands;
DROP FUNCTION IF EXISTS public.fn_record_inventory_consumption_for_completed_demand();

DELETE FROM public.inventory_movements;

DROP VIEW IF EXISTS public.dealer_inventory_balances;
DROP TABLE IF EXISTS public.dealer_inventory_thresholds;
DROP TABLE IF EXISTS public.inventory_movements;

-- Migrate pricing before drop
CREATE TABLE IF NOT EXISTS public.inventory_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('national', 'province', 'city', 'region', 'dealer')),
  scope_id uuid,
  camera_model_id uuid REFERENCES public.camera_models(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN ('installation', 'transfer', 'removal')),
  price_cad numeric(10,2) NOT NULL CHECK (price_cad >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_pricing_rules_scope_unique
  ON public.inventory_pricing_rules (
    scope_type,
    COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(camera_model_id, '00000000-0000-0000-0000-000000000000'::uuid),
    service_type
  );

INSERT INTO public.inventory_pricing_rules (scope_type, scope_id, camera_model_id, service_type, price_cad)
SELECT 'dealer', dealer_id, camera_model_id, 'installation', price_cad
FROM public.dealer_camera_pricing
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_pricing_rules (scope_type, scope_id, camera_model_id, service_type, price_cad)
VALUES
  ('national', NULL, NULL, 'transfer', 150),
  ('national', NULL, NULL, 'removal', 100)
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS public.dealer_camera_pricing;

UPDATE public.camera_models SET stock_quantity = 0 WHERE stock_quantity IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Geography (inventory-specific)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES public.inventory_provinces(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_id, code)
);

CREATE TABLE IF NOT EXISTS public.inventory_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.inventory_cities(id) ON DELETE CASCADE,
  province_id uuid NOT NULL REFERENCES public.inventory_provinces(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, code)
);

ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS inventory_region_id uuid REFERENCES public.inventory_regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dealers_inventory_region ON public.dealers (inventory_region_id);

-- ---------------------------------------------------------------------------
-- 3. Locations + movements v2
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type text NOT NULL CHECK (location_type IN ('national', 'province', 'city', 'region', 'dealer', 'specialist')),
  province_id uuid REFERENCES public.inventory_provinces(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.inventory_cities(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.inventory_regions(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE CASCADE,
  specialist_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_locations_type_fk_check CHECK (
    (location_type = 'national' AND province_id IS NULL AND city_id IS NULL AND region_id IS NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
    OR (location_type = 'province' AND province_id IS NOT NULL AND city_id IS NULL AND region_id IS NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
    OR (location_type = 'city' AND city_id IS NOT NULL AND region_id IS NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
    OR (location_type = 'region' AND region_id IS NOT NULL AND dealer_id IS NULL AND specialist_profile_id IS NULL)
    OR (location_type = 'dealer' AND dealer_id IS NOT NULL AND specialist_profile_id IS NULL)
    OR (location_type = 'specialist' AND specialist_profile_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_national_unique
  ON public.inventory_locations (location_type) WHERE location_type = 'national';
CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_province_unique
  ON public.inventory_locations (province_id) WHERE location_type = 'province';
CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_city_unique
  ON public.inventory_locations (city_id) WHERE location_type = 'city';
CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_region_unique
  ON public.inventory_locations (region_id) WHERE location_type = 'region';
CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_dealer_unique
  ON public.inventory_locations (dealer_id) WHERE location_type = 'dealer';
CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_specialist_unique
  ON public.inventory_locations (specialist_profile_id) WHERE location_type = 'specialist';

CREATE TABLE IF NOT EXISTS public.inventory_movements_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_model_id uuid NOT NULL REFERENCES public.camera_models(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'allocation', 'transfer', 'consumption', 'adjustment', 'return')),
  quantity integer NOT NULL CHECK (quantity > 0),
  from_location_id uuid REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  to_location_id uuid REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  reference_demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL,
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_v2_location_check CHECK (
    from_location_id IS NOT NULL OR to_location_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_v2_created ON public.inventory_movements_v2 (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_v2_from ON public.inventory_movements_v2 (from_location_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_v2_to ON public.inventory_movements_v2 (to_location_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_v2_model ON public.inventory_movements_v2 (camera_model_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_v2_one_consumption_per_demand
  ON public.inventory_movements_v2 (reference_demand_id)
  WHERE movement_type = 'consumption' AND reference_demand_id IS NOT NULL;

CREATE OR REPLACE VIEW public.inventory_balances_v2 AS
SELECT
  loc.id AS location_id,
  loc.location_type,
  loc.label,
  m.camera_model_id,
  (
    COALESCE(SUM(CASE WHEN m.to_location_id = loc.id THEN m.quantity ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.from_location_id = loc.id THEN m.quantity ELSE 0 END), 0)
  )::bigint AS quantity
FROM public.inventory_locations loc
LEFT JOIN public.inventory_movements_v2 m
  ON m.to_location_id = loc.id OR m.from_location_id = loc.id
GROUP BY loc.id, loc.location_type, loc.label, m.camera_model_id;

CREATE TABLE IF NOT EXISTS public.inventory_thresholds (
  location_id uuid NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  camera_model_id uuid NOT NULL REFERENCES public.camera_models(id) ON DELETE CASCADE,
  min_qty integer NOT NULL DEFAULT 2 CHECK (min_qty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, camera_model_id)
);

-- ---------------------------------------------------------------------------
-- 4. Seed provinces + national location + backfill locations
-- ---------------------------------------------------------------------------
INSERT INTO public.inventory_provinces (code, name, sort_order) VALUES
  ('AB', 'Alberta', 1),
  ('BC', 'British Columbia', 2),
  ('MB', 'Manitoba', 3),
  ('NB', 'New Brunswick', 4),
  ('NL', 'Newfoundland and Labrador', 5),
  ('NS', 'Nova Scotia', 6),
  ('NT', 'Northwest Territories', 7),
  ('NU', 'Nunavut', 8),
  ('ON', 'Ontario', 9),
  ('PE', 'Prince Edward Island', 10),
  ('QC', 'Quebec', 11),
  ('SK', 'Saskatchewan', 12),
  ('YT', 'Yukon', 13)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.inventory_locations (location_type, label)
SELECT 'national', 'Canada — General Stock'
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE location_type = 'national');

INSERT INTO public.inventory_locations (location_type, province_id, label)
SELECT 'province', p.id, p.name || ' — Province Stock'
FROM public.inventory_provinces p
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_locations l WHERE l.location_type = 'province' AND l.province_id = p.id
);

INSERT INTO public.inventory_locations (location_type, dealer_id, label)
SELECT 'dealer', d.id, d.name || ' — Dealer Stock'
FROM public.dealers d
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_locations l WHERE l.location_type = 'dealer' AND l.dealer_id = d.id
);

INSERT INTO public.inventory_locations (location_type, specialist_profile_id, label)
SELECT 'specialist', p.id, COALESCE(p.full_name, 'Specialist') || ' — Field Stock'
FROM public.profiles p
WHERE p.role = 'specialist'
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_locations l WHERE l.location_type = 'specialist' AND l.specialist_profile_id = p.id
  );

-- ---------------------------------------------------------------------------
-- 5. Consumption trigger (dealer stock on installation complete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_inventory_v2_consumption_for_completed_demand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_model_id uuid;
  v_dealer_loc uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.service_type IS NOT NULL AND NEW.service_type <> 'installation' THEN RETURN NEW; END IF;
  IF NEW.dealer_id IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_movements_v2 m
    WHERE m.reference_demand_id = NEW.id AND m.movement_type = 'consumption'
  ) THEN RETURN NEW; END IF;

  v_model_id := NEW.camera_model_id;
  IF v_model_id IS NULL AND NEW.camera_model IS NOT NULL AND trim(NEW.camera_model) <> '' THEN
    SELECT cm.id INTO v_model_id
    FROM public.camera_models cm
    WHERE lower(trim(cm.name)) = lower(trim(NEW.camera_model))
      AND (cm.is_active IS NULL OR cm.is_active = true)
    LIMIT 1;
  END IF;
  IF v_model_id IS NULL THEN RETURN NEW; END IF;

  SELECT l.id INTO v_dealer_loc
  FROM public.inventory_locations l
  WHERE l.location_type = 'dealer' AND l.dealer_id = NEW.dealer_id
  LIMIT 1;

  IF v_dealer_loc IS NULL THEN
    INSERT INTO public.inventory_locations (location_type, dealer_id, label)
    SELECT 'dealer', NEW.dealer_id, COALESCE(d.name, 'Dealer') || ' — Dealer Stock'
    FROM public.dealers d WHERE d.id = NEW.dealer_id
    RETURNING id INTO v_dealer_loc;
  END IF;

  INSERT INTO public.inventory_movements_v2 (
    camera_model_id, movement_type, quantity, from_location_id, reference_demand_id, note
  ) VALUES (
    v_model_id, 'consumption', 1, v_dealer_loc, NEW.id, 'Auto consumption on demand completion'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_demands_inventory_v2_consumption ON public.demands;
CREATE TRIGGER tr_demands_inventory_v2_consumption
  AFTER INSERT OR UPDATE OF status, camera_model, camera_model_id, service_type ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_record_inventory_v2_consumption_for_completed_demand();

-- ---------------------------------------------------------------------------
-- 6. Helper: ensure region location when region created
-- ---------------------------------------------------------------------------
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE location_type = 'region' AND region_id = NEW.id) THEN
    INSERT INTO public.inventory_locations (location_type, region_id, city_id, province_id, label)
    VALUES ('region', NEW.id, NEW.city_id, NEW.province_id, NEW.name || ' — Inner Region Stock');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_inventory_regions_location ON public.inventory_regions;
CREATE TRIGGER tr_inventory_regions_location
  AFTER INSERT ON public.inventory_regions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ensure_inventory_region_location();

CREATE OR REPLACE FUNCTION public.fn_ensure_inventory_dealer_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE location_type = 'dealer' AND dealer_id = NEW.id) THEN
    INSERT INTO public.inventory_locations (location_type, dealer_id, label)
    VALUES ('dealer', NEW.id, COALESCE(NEW.name, 'Dealer') || ' — Dealer Stock');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dealers_inventory_location ON public.dealers;
CREATE TRIGGER tr_dealers_inventory_location
  AFTER INSERT ON public.dealers
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ensure_inventory_dealer_location();

-- ---------------------------------------------------------------------------
-- 7. Reset RPC v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_inventory_v2_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'
  ) THEN
    RAISE EXCEPTION 'Only Aurora Manager can reset inventory';
  END IF;

  DELETE FROM public.inventory_movements_v2;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.camera_models SET stock_quantity = 0;

  RETURN jsonb_build_object('success', true, 'movements_deleted', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_inventory_v2_data() TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_provinces_am ON public.inventory_provinces;
CREATE POLICY inventory_provinces_am ON public.inventory_provinces FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS inventory_cities_am ON public.inventory_cities;
CREATE POLICY inventory_cities_am ON public.inventory_cities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS inventory_regions_am ON public.inventory_regions;
CREATE POLICY inventory_regions_am ON public.inventory_regions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS inventory_locations_am ON public.inventory_locations;
CREATE POLICY inventory_locations_am ON public.inventory_locations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS inventory_movements_v2_am ON public.inventory_movements_v2;
CREATE POLICY inventory_movements_v2_am ON public.inventory_movements_v2 FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS inventory_thresholds_am ON public.inventory_thresholds;
CREATE POLICY inventory_thresholds_am ON public.inventory_thresholds FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS inventory_pricing_rules_am ON public.inventory_pricing_rules;
CREATE POLICY inventory_pricing_rules_am ON public.inventory_pricing_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

COMMENT ON TABLE public.inventory_movements_v2 IS 'Hierarchical inventory ledger v2; balances via inventory_balances_v2 view.';
