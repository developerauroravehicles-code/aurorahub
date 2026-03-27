-- Inventory ledger (dealer stock), consumption on demand completion, thresholds, camera_model_id on demands.

-- 1. Demand FK to catalog (optional resolution from name in trigger)
ALTER TABLE public.demands
ADD COLUMN IF NOT EXISTS camera_model_id uuid REFERENCES public.camera_models(id);

CREATE INDEX IF NOT EXISTS idx_demands_camera_model_id ON public.demands(camera_model_id);

-- 2. Movement type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
    CREATE TYPE public.inventory_movement_type AS ENUM (
      'receipt',
      'consumption',
      'adjustment',
      'return_to_hq'
    );
  END IF;
END $$;

-- 3. Ledger table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  camera_model_id uuid NOT NULL REFERENCES public.camera_models(id) ON DELETE RESTRICT,
  quantity_delta integer NOT NULL,
  movement_type public.inventory_movement_type NOT NULL,
  reference_demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL,
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_consumption_qty_check CHECK (
    movement_type != 'consumption' OR quantity_delta < 0
  ),
  CONSTRAINT inventory_movements_represent_positive_qty_check CHECK (
    movement_type = 'consumption' OR quantity_delta != 0
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_movemts_dealer ON public.inventory_movements(dealer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movemts_model ON public.inventory_movements(camera_model_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movemts_created ON public.inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movemts_demand ON public.inventory_movements(reference_demand_id)
  WHERE reference_demand_id IS NOT NULL;

-- At most one consumption row per demand
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_one_consumption_per_demand
  ON public.inventory_movements (reference_demand_id)
  WHERE movement_type = 'consumption';

-- 4. Balance view
CREATE OR REPLACE VIEW public.dealer_inventory_balances AS
SELECT
  dealer_id,
  camera_model_id,
  SUM(quantity_delta)::bigint AS quantity
FROM public.inventory_movements
GROUP BY dealer_id, camera_model_id;

-- 5. Low-stock thresholds (per dealer + model)
CREATE TABLE IF NOT EXISTS public.dealer_inventory_thresholds (
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  camera_model_id uuid NOT NULL REFERENCES public.camera_models(id) ON DELETE CASCADE,
  min_qty integer NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dealer_id, camera_model_id)
);

-- 6. RLS
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_inventory_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aurora_manager_select_inventory_movements" ON public.inventory_movements;
CREATE POLICY "aurora_manager_select_inventory_movements"
  ON public.inventory_movements FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager')
  );

DROP POLICY IF EXISTS "aurora_manager_insert_inventory_movements" ON public.inventory_movements;
CREATE POLICY "aurora_manager_insert_inventory_movements"
  ON public.inventory_movements FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager')
  );

DROP POLICY IF EXISTS "aurora_manager_all_inventory_thresholds" ON public.dealer_inventory_thresholds;
CREATE POLICY "aurora_manager_all_inventory_thresholds"
  ON public.dealer_inventory_thresholds FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager')
  );

-- 7. SECURITY DEFINER: record consumption when demand becomes completed
CREATE OR REPLACE FUNCTION public.fn_record_inventory_consumption_for_completed_demand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_model_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'completed' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.dealer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_movements m
    WHERE m.reference_demand_id = NEW.id AND m.movement_type = 'consumption'
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

  IF v_model_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.inventory_movements (
    dealer_id,
    camera_model_id,
    quantity_delta,
    movement_type,
    reference_demand_id,
    note,
    created_by
  ) VALUES (
    NEW.dealer_id,
    v_model_id,
    -1,
    'consumption',
    NEW.id,
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_demands_inventory_consumption ON public.demands;
CREATE TRIGGER tr_demands_inventory_consumption
  AFTER INSERT OR UPDATE OF status, camera_model, camera_model_id ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_record_inventory_consumption_for_completed_demand();

-- 8. Backfill: historical completed demands (idempotent via unique index)
INSERT INTO public.inventory_movements (
  dealer_id,
  camera_model_id,
  quantity_delta,
  movement_type,
  reference_demand_id,
  note,
  created_at
)
SELECT
  d.dealer_id,
  COALESCE(d.camera_model_id, cm.id),
  -1,
  'consumption'::public.inventory_movement_type,
  d.id,
  'Backfill from completed demand',
  COALESCE(d.completed_at, d.updated_at, d.created_at, now())
FROM public.demands d
LEFT JOIN public.camera_models cm
  ON d.camera_model_id IS NULL
  AND d.camera_model IS NOT NULL
  AND lower(trim(cm.name)) = lower(trim(d.camera_model))
  AND (cm.is_active IS NULL OR cm.is_active = true)
WHERE d.status = 'completed'
  AND d.dealer_id IS NOT NULL
  AND COALESCE(d.camera_model_id, cm.id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_movements m
    WHERE m.reference_demand_id = d.id AND m.movement_type = 'consumption'
  );

COMMENT ON TABLE public.inventory_movements IS 'Dealer camera stock ledger; consumption rows linked to completed demands.';
COMMENT ON VIEW public.dealer_inventory_balances IS 'SUM(quantity_delta) per dealer and camera model.';
