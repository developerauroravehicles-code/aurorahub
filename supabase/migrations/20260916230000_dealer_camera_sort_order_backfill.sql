-- Give each dealer's cameras distinct sort_order (10, 20, …) by assignment time when still default 0.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY dealer_id
      ORDER BY created_at ASC NULLS LAST, camera_model_id ASC
    ) * 10 AS new_order
  FROM public.dealer_cameras
  WHERE sort_order = 0
)
UPDATE public.dealer_cameras dc
SET sort_order = ranked.new_order
FROM ranked
WHERE dc.id = ranked.id;
