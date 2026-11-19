-- Individual Sales (Aurora Manager). Schema only — overlap trigger patched in 20261119180100.
-- If you hit deadlock in SQL Editor: run this file alone, wait ~30s, then run 20261119180100.

ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS is_individual_sales_hub boolean NOT NULL DEFAULT false;

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS is_individual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dealers.is_individual_sales_hub IS
  'When true, this dealer record is the Aurora Manager Individual Sales hub (at most one).';
COMMENT ON COLUMN public.demands.is_individual IS
  'Aurora Manager direct sales; does not use dealer calendar or pool capacity.';

INSERT INTO public.dealers (code, name, address, is_individual_sales_hub, warranty_years)
VALUES (
  'AURORA_INDIVIDUAL',
  'Individual Sales',
  'Aurora Direct Sales',
  true,
  3
)
ON CONFLICT (code) DO UPDATE
SET
  is_individual_sales_hub = EXCLUDED.is_individual_sales_hub,
  name = EXCLUDED.name,
  address = COALESCE(EXCLUDED.address, public.dealers.address);

-- At most one hub row (constant expression partial unique — safe idiom).
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealers_single_individual_sales_hub
  ON public.dealers ((1))
  WHERE is_individual_sales_hub = true;

CREATE INDEX IF NOT EXISTS idx_demands_individual_pending
  ON public.demands (status, appointment_date DESC)
  WHERE is_individual = true AND status <> 'cancelled';