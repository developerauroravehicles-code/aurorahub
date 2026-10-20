-- Event types used by delete-barcode and reassign-demand-barcode
ALTER TABLE public.inventory_barcode_events DROP CONSTRAINT IF EXISTS inventory_barcode_events_event_type_check;
ALTER TABLE public.inventory_barcode_events ADD CONSTRAINT inventory_barcode_events_event_type_check
  CHECK (event_type IN (
    'generated',
    'assigned_dealer',
    'assigned_specialist',
    'consumed',
    'void',
    'deleted',
    'released_from_demand',
    'release_consumed',
    'reassigned_to_demand'
  ));
