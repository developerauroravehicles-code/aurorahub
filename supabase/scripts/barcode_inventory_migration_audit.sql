-- Barcode + inventory v2 migration audit (run in Supabase SQL Editor on each environment)
-- Expected: barcode mode ON in prod; index _location_model; trigger skips auto consume when barcode mode ON

-- 1) Consumption unique index (multi-barcode / multi-model per demand)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'inventory_movements_v2'
  AND indexname LIKE '%consumption%';
-- EXPECT: inventory_movements_v2_consumption_per_demand_location_model
-- NOT: inventory_movements_v2_consumption_per_demand_location (legacy — breaks 2nd barcode)

-- 2) Barcode event_type CHECK allowed values
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.inventory_barcode_events'::regclass
  AND contype = 'c'
  AND conname LIKE '%event_type%';
-- EXPECT includes: deleted, reassigned_to_demand, release_consumed, released_from_demand

-- 3) Barcode mode flag
SELECT public.is_barcode_mode_enabled() AS barcode_mode_enabled;
SELECT key, value::jsonb AS settings
FROM public.system_settings
WHERE key = 'barcode_settings';

-- 4) Demand completion trigger uses barcode-mode skip (body should mention v_barcode_mode early return)
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'fn_record_inventory_v2_consumption_for_completed_demand';

-- 5) Specialist barcode RPC exists
SELECT p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'lookup_specialist_barcode_for_completion';

-- 6) Orphan consumed barcodes (demand deleted but barcode still consumed)
SELECT b.code, b.status, b.demand_id, b.consumed_at
FROM public.inventory_barcodes b
WHERE b.status = 'consumed'
  AND b.demand_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.demands d WHERE d.id = b.demand_id);

-- 7) Consumption movements pointing at missing demands
SELECT m.id, m.reference_demand_id, m.camera_model_id, m.quantity, m.from_location_id
FROM public.inventory_movements_v2 m
WHERE m.movement_type = 'consumption'
  AND m.reference_demand_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.demands d WHERE d.id = m.reference_demand_id)
LIMIT 50;
