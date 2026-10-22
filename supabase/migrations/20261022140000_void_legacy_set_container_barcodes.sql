-- Set container barcodes (kind = set) are deprecated; booking uses unit labels only.
UPDATE public.inventory_barcodes
SET
  status = 'void',
  updated_at = timezone('utc', now())
WHERE kind = 'set'
  AND status IN ('generated', 'at_dealer', 'at_specialist');

INSERT INTO public.inventory_barcode_events (barcode_id, event_type, actor_id, metadata)
SELECT
  id,
  'void',
  NULL,
  jsonb_build_object(
    'reason', 'legacy_set_container_deprecated',
    'note', 'Set container barcodes removed; use unit labels from set templates only.'
  )
FROM public.inventory_barcodes
WHERE kind = 'set'
  AND status = 'void'
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory_barcode_events e
    WHERE e.barcode_id = inventory_barcodes.id
      AND e.event_type = 'void'
      AND e.metadata->>'reason' = 'legacy_set_container_deprecated'
  );
