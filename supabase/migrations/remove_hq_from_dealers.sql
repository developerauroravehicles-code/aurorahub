-- Remove HQ from dealers table: Aurora is the service provider (platform), not a dealer.
-- Aurora Manager profiles use dealer_id = NULL and login with code "HQ".

DO $$
DECLARE
  hq_dealer_id uuid;
  demands_count int;
BEGIN
  -- Find HQ dealer (code = 'HQ', case-insensitive)
  SELECT id INTO hq_dealer_id
  FROM dealers
  WHERE UPPER(TRIM(code)) = 'HQ'
  LIMIT 1;

  -- If no HQ dealer exists, nothing to do
  IF hq_dealer_id IS NULL THEN
    RETURN;
  END IF;

  -- Check for demands linked to HQ dealer - must be resolved before migration
  SELECT COUNT(*) INTO demands_count
  FROM demands
  WHERE dealer_id = hq_dealer_id;

  IF demands_count > 0 THEN
    RAISE EXCEPTION 'Cannot remove HQ dealer: % demand(s) are linked to it. Reassign or delete them first.', demands_count;
  END IF;

  -- Set Aurora Manager and other platform users to dealer_id = NULL
  UPDATE profiles
  SET dealer_id = NULL
  WHERE dealer_id = hq_dealer_id;

  -- Child tables (dealer_calendar_settings, dealer_calendar_blocks, dealer_cameras, specialist_dealers)
  -- have ON DELETE CASCADE, so they will be cleaned up when we delete the dealer.

  -- Delete HQ dealer
  DELETE FROM dealers
  WHERE id = hq_dealer_id;
END $$;
