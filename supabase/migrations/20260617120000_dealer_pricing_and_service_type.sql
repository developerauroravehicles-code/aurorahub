-- Dealer-based camera pricing and demand service types for automatic invoicing.

-- 1. Service type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_service_type') THEN
    CREATE TYPE public.demand_service_type AS ENUM ('installation', 'transfer', 'removal');
  END IF;
END $$;

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS service_type public.demand_service_type;

COMMENT ON COLUMN public.demands.service_type IS
  'Job type selected at completion: installation (dealer pricing), transfer ($150), removal ($100).';

-- 2. Dealer × camera model pricing
CREATE TABLE IF NOT EXISTS public.dealer_camera_pricing (
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  camera_model_id uuid NOT NULL REFERENCES public.camera_models(id) ON DELETE CASCADE,
  price_cad numeric(10,2) NOT NULL CHECK (price_cad >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dealer_id, camera_model_id)
);

COMMENT ON TABLE public.dealer_camera_pricing IS
  'Per-dealer installation price (CAD) for each camera model. Used for automatic invoice on completion.';

ALTER TABLE public.dealer_camera_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aurora_manager_all_dealer_camera_pricing" ON public.dealer_camera_pricing;
CREATE POLICY "aurora_manager_all_dealer_camera_pricing"
  ON public.dealer_camera_pricing FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'aurora_manager')
  );

-- 3. Inventory consumption only for installation (or legacy NULL service_type)
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

  -- Transfer and removal do not consume inventory stock.
  IF NEW.service_type IS NOT NULL AND NEW.service_type <> 'installation' THEN
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

-- Re-create trigger to also react to service_type changes on completion
DROP TRIGGER IF EXISTS tr_demands_inventory_consumption ON public.demands;
CREATE TRIGGER tr_demands_inventory_consumption
  AFTER INSERT OR UPDATE OF status, camera_model, camera_model_id, service_type ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_record_inventory_consumption_for_completed_demand();
