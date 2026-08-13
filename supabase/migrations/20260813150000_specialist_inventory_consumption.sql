-- Specialist field stock: dual consumption (dealer + specialist) on demand complete,
-- location-based idempotency, and self-service RPC for specialists.

-- Allow multiple consumption rows per demand (one per from_location).
DROP INDEX IF EXISTS public.inventory_movements_v2_one_consumption_per_demand;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_v2_consumption_per_demand_location
  ON public.inventory_movements_v2 (reference_demand_id, from_location_id)
  WHERE movement_type = 'consumption' AND reference_demand_id IS NOT NULL;

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

  v_model_id := NEW.camera_model_id;
  IF v_model_id IS NULL AND NEW.camera_model IS NOT NULL AND trim(NEW.camera_model) <> '' THEN
    SELECT cm.id INTO v_model_id
    FROM public.camera_models cm
    WHERE lower(trim(cm.name)) = lower(trim(NEW.camera_model))
      AND (cm.is_active IS NULL OR cm.is_active = true)
    LIMIT 1;
  END IF;
  IF v_model_id IS NULL THEN RETURN NEW; END IF;

  -- Dealer consumption
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

  -- Specialist consumption (when assigned)
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

DROP TRIGGER IF EXISTS tr_demands_inventory_v2_consumption ON public.demands;
CREATE TRIGGER tr_demands_inventory_v2_consumption
  AFTER INSERT OR UPDATE OF status, camera_model, camera_model_id, service_type, assigned_specialist_id
  ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_record_inventory_v2_consumption_for_completed_demand();

-- Specialist self-service: read own field camera stock without inventory RLS.
CREATE OR REPLACE FUNCTION public.get_my_field_camera_stock()
RETURNS TABLE (
  camera_model_id uuid,
  model_name text,
  quantity bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_loc_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT l.id INTO v_loc_id
  FROM public.inventory_locations l
  WHERE l.location_type = 'specialist' AND l.specialist_profile_id = auth.uid()
  LIMIT 1;

  IF v_loc_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.camera_model_id,
    cm.name AS model_name,
    b.quantity
  FROM public.inventory_balances_v2 b
  JOIN public.camera_models cm ON cm.id = b.camera_model_id
  WHERE b.location_id = v_loc_id
    AND b.camera_model_id IS NOT NULL
    AND b.quantity <> 0
  ORDER BY cm.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_field_camera_stock() TO authenticated;

COMMENT ON FUNCTION public.get_my_field_camera_stock IS
  'Returns field camera stock for the authenticated specialist (inventory_balances_v2 at specialist location).';
