-- Barcode mode: stock changes only via barcode assign/consume, not demand completion trigger.
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
  IF v_barcode_mode THEN
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
