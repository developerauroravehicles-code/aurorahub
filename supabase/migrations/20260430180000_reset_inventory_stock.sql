-- One-time reset: clear dealer inventory ledger and HQ catalog quantity fields.
-- Does NOT replay consumption from historical completed demands (see project plan).
-- Thresholds (dealer_inventory_thresholds) are left unchanged.
-- After reset: post real stock via Receipt / adjust; new completed demands will consume as before.

DELETE FROM public.inventory_movements;

UPDATE public.camera_models SET stock_quantity = 0;

-- Repeatable reset for Aurora Manager via Supabase client (auth.uid() checked inside).
CREATE OR REPLACE FUNCTION public.reset_inventory_stock_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_deleted bigint;
BEGIN
  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role IS DISTINCT FROM 'aurora_manager' THEN
    RAISE EXCEPTION 'Only Aurora Manager can reset inventory stock'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.inventory_movements;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.camera_models SET stock_quantity = 0;

  RETURN jsonb_build_object(
    'success', true,
    'movements_deleted', v_deleted,
    'hq_stock_reset', true
  );
END;
$$;

COMMENT ON FUNCTION public.reset_inventory_stock_data() IS
  'Deletes all inventory_movements and sets camera_models.stock_quantity to 0. Caller must be aurora_manager.';

GRANT EXECUTE ON FUNCTION public.reset_inventory_stock_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_inventory_stock_data() TO service_role;
