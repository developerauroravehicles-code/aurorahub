-- Allow audit events for manual consume release and demand barcode swap
ALTER TABLE public.inventory_barcode_events DROP CONSTRAINT IF EXISTS inventory_barcode_events_event_type_check;
ALTER TABLE public.inventory_barcode_events ADD CONSTRAINT inventory_barcode_events_event_type_check
  CHECK (event_type IN (
    'generated',
    'assigned_dealer',
    'assigned_specialist',
    'consumed',
    'void',
    'released_from_demand',
    'release_consumed'
  ));
