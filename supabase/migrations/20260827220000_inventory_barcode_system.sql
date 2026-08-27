-- Inventory barcode system: unique unit/set codes, traceability, feature toggle.

INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
  'barcode_settings',
  '{"enabled":false,"codePrefix":"AUR"}',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- Set templates
CREATE TABLE IF NOT EXISTS public.inventory_barcode_set_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_barcode_set_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.inventory_barcode_set_templates(id) ON DELETE CASCADE,
  camera_model_id uuid NOT NULL REFERENCES public.camera_models(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  UNIQUE (template_id, camera_model_id)
);

CREATE INDEX IF NOT EXISTS idx_barcode_set_template_items_template
  ON public.inventory_barcode_set_template_items(template_id);

-- Barcodes
CREATE TABLE IF NOT EXISTS public.inventory_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('unit', 'set')),
  camera_model_id uuid REFERENCES public.camera_models(id) ON DELETE SET NULL,
  set_template_id uuid REFERENCES public.inventory_barcode_set_templates(id) ON DELETE SET NULL,
  parent_barcode_id uuid REFERENCES public.inventory_barcodes(id) ON DELETE SET NULL,
  batch_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'at_dealer', 'at_specialist', 'consumed', 'void')),
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  specialist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  inventory_location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL,
  consumed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_barcodes_status ON public.inventory_barcodes(status);
CREATE INDEX IF NOT EXISTS idx_inventory_barcodes_dealer ON public.inventory_barcodes(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_barcodes_specialist ON public.inventory_barcodes(specialist_id);
CREATE INDEX IF NOT EXISTS idx_inventory_barcodes_demand ON public.inventory_barcodes(demand_id);
CREATE INDEX IF NOT EXISTS idx_inventory_barcodes_parent ON public.inventory_barcodes(parent_barcode_id);
CREATE INDEX IF NOT EXISTS idx_inventory_barcodes_batch ON public.inventory_barcodes(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_barcodes_code_lower ON public.inventory_barcodes(lower(code));

-- Audit events
CREATE TABLE IF NOT EXISTS public.inventory_barcode_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_id uuid NOT NULL REFERENCES public.inventory_barcodes(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN ('generated', 'assigned_dealer', 'assigned_specialist', 'consumed', 'void')
  ),
  demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_barcode_events_barcode
  ON public.inventory_barcode_events(barcode_id, created_at DESC);

-- RLS
ALTER TABLE public.inventory_barcode_set_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_barcode_set_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_barcode_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aurora managers manage barcode set templates" ON public.inventory_barcode_set_templates;
CREATE POLICY "Aurora managers manage barcode set templates"
  ON public.inventory_barcode_set_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS "Aurora managers manage barcode set template items" ON public.inventory_barcode_set_template_items;
CREATE POLICY "Aurora managers manage barcode set template items"
  ON public.inventory_barcode_set_template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS "Aurora managers manage inventory barcodes" ON public.inventory_barcodes;
CREATE POLICY "Aurora managers manage inventory barcodes"
  ON public.inventory_barcodes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS "Aurora managers view barcode events" ON public.inventory_barcode_events;
CREATE POLICY "Aurora managers view barcode events"
  ON public.inventory_barcode_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

DROP POLICY IF EXISTS "Aurora managers insert barcode events" ON public.inventory_barcode_events;
CREATE POLICY "Aurora managers insert barcode events"
  ON public.inventory_barcode_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager'));

-- Helper: is barcode mode enabled
CREATE OR REPLACE FUNCTION public.is_barcode_mode_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (value::jsonb ->> 'enabled')::boolean
      FROM public.system_settings
      WHERE key = 'barcode_settings'
      LIMIT 1
    ),
    false
  );
$$;

-- Update consumption trigger to skip when barcode mode + linked barcode on demand
CREATE OR REPLACE FUNCTION public.fn_record_inventory_v2_consumption_for_completed_demand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_model_id uuid;
  v_dealer_loc uuid;
  v_specialist_loc uuid;
  v_barcode_mode boolean;
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

  v_barcode_mode := public.is_barcode_mode_enabled();
  IF v_barcode_mode AND EXISTS (
    SELECT 1 FROM public.inventory_barcodes b
    WHERE b.demand_id = NEW.id AND b.status = 'consumed'
  ) THEN
    RETURN NEW;
  END IF;

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

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_movements_v2 m
    WHERE m.reference_demand_id = NEW.id
      AND m.movement_type = 'consumption'
      AND m.from_location_id = v_dealer_loc
  ) THEN
    INSERT INTO public.inventory_movements_v2 (
      camera_model_id, movement_type, quantity, from_location_id, reference_demand_id, note
    ) VALUES (
      v_model_id, 'consumption', 1, v_dealer_loc, NEW.id,
      'Auto consumption on demand completion (dealer)'
    );
  END IF;

  IF NEW.assigned_specialist_id IS NOT NULL THEN
    SELECT l.id INTO v_specialist_loc
    FROM public.inventory_locations l
    WHERE l.location_type = 'specialist' AND l.specialist_profile_id = NEW.assigned_specialist_id
    LIMIT 1;

    IF v_specialist_loc IS NULL THEN
      INSERT INTO public.inventory_locations (location_type, specialist_profile_id, label)
      SELECT 'specialist', NEW.assigned_specialist_id,
        COALESCE(p.full_name, 'Specialist') || ' — Field Stock'
      FROM public.profiles p WHERE p.id = NEW.assigned_specialist_id
      RETURNING id INTO v_specialist_loc;
    END IF;

    IF v_specialist_loc IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.inventory_movements_v2 m
      WHERE m.reference_demand_id = NEW.id
        AND m.movement_type = 'consumption'
        AND m.from_location_id = v_specialist_loc
    ) THEN
      INSERT INTO public.inventory_movements_v2 (
        camera_model_id, movement_type, quantity, from_location_id, reference_demand_id, note
      ) VALUES (
        v_model_id, 'consumption', 1, v_specialist_loc, NEW.id,
        'Auto consumption on demand completion (specialist field stock)'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Specialist barcode lookup for completion (no direct table access for specialists)
CREATE OR REPLACE FUNCTION public.lookup_specialist_barcode_for_completion(p_code text)
RETURNS TABLE (
  barcode_id uuid,
  code text,
  camera_model_id uuid,
  camera_model_name text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'specialist'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.code,
    b.camera_model_id,
    cm.name,
    b.status
  FROM public.inventory_barcodes b
  LEFT JOIN public.camera_models cm ON cm.id = b.camera_model_id
  WHERE lower(trim(b.code)) = lower(trim(p_code))
    AND b.kind = 'unit'
    AND b.status = 'at_specialist'
    AND b.specialist_id = auth.uid()
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_barcode_mode_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_specialist_barcode_for_completion(text) TO authenticated;

COMMENT ON TABLE public.inventory_barcodes IS
  'Unique scannable codes for physical camera units and set containers.';
COMMENT ON FUNCTION public.lookup_specialist_barcode_for_completion IS
  'Specialists validate a barcode assigned to them before completing a demand.';
