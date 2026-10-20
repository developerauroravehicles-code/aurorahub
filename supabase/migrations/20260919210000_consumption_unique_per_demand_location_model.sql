-- Allow multiple consumption rows per demand from the same location (different camera models, or qty > 1).
DROP INDEX IF EXISTS public.inventory_movements_v2_consumption_per_demand_location;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_v2_consumption_per_demand_location_model
  ON public.inventory_movements_v2 (reference_demand_id, from_location_id, camera_model_id)
  WHERE movement_type = 'consumption'
    AND reference_demand_id IS NOT NULL
    AND camera_model_id IS NOT NULL;
