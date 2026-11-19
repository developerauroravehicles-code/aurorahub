-- Manual apply if migrations deadlock in SQL Editor. Run each section separately (highlight + Run).

-- === 1) Columns + hub dealer ===
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS is_individual_sales_hub boolean NOT NULL DEFAULT false;

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS is_individual boolean NOT NULL DEFAULT false;

INSERT INTO public.dealers (code, name, address, is_individual_sales_hub, warranty_years)
VALUES ('AURORA_INDIVIDUAL', 'Individual Sales', 'Aurora Direct Sales', true, 3)
ON CONFLICT (code) DO UPDATE
SET is_individual_sales_hub = true,
    name = EXCLUDED.name,
    address = COALESCE(EXCLUDED.address, public.dealers.address);

-- === 2) Indexes (wait 30s after step 1 if needed) ===
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealers_single_individual_sales_hub
  ON public.dealers ((1))
  WHERE is_individual_sales_hub = true;

CREATE INDEX IF NOT EXISTS idx_demands_individual_pending
  ON public.demands (status, appointment_date DESC)
  WHERE is_individual = true AND status <> 'cancelled';

-- === 3) Overlap function — paste contents of 20261119180100_individual_sales_overlap_trigger.sql ===