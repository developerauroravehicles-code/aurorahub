-- Regional scheduling pools: slot overlap scoped per pool with specialist capacity.

CREATE TABLE IF NOT EXISTS scheduling_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS scheduling_pool_id uuid REFERENCES scheduling_pools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dealers_scheduling_pool_id ON dealers(scheduling_pool_id);

ALTER TABLE scheduling_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scheduling pools viewable by authenticated" ON scheduling_pools;
CREATE POLICY "Scheduling pools viewable by authenticated"
  ON scheduling_pools FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Aurora Managers can manage scheduling pools" ON scheduling_pools;
CREATE POLICY "Aurora Managers can manage scheduling pools"
  ON scheduling_pools FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')
    )
  );

-- Backfill: one pool per region_code; fallback DEFAULT pool for dealers without region.
INSERT INTO scheduling_pools (code, name, description)
SELECT
  'RC-' || rc.code,
  rc.name || ' (scheduling)',
  COALESCE(rc.description, 'Auto-created from region code')
FROM region_codes rc
WHERE NOT EXISTS (
  SELECT 1 FROM scheduling_pools sp WHERE sp.code = 'RC-' || rc.code
);

INSERT INTO scheduling_pools (code, name, description)
SELECT 'DEFAULT', 'Default Scheduling Pool', 'Dealers without a region assignment'
WHERE NOT EXISTS (SELECT 1 FROM scheduling_pools WHERE code = 'DEFAULT');

UPDATE dealers d
SET scheduling_pool_id = sp.id
FROM region_codes rc
JOIN scheduling_pools sp ON sp.code = 'RC-' || rc.code
WHERE d.region_code_id = rc.id
  AND d.scheduling_pool_id IS NULL;

UPDATE dealers d
SET scheduling_pool_id = (SELECT id FROM scheduling_pools WHERE code = 'DEFAULT' LIMIT 1)
WHERE d.scheduling_pool_id IS NULL;

-- Capacity = distinct specialists linked to dealers in the pool (min 1).
CREATE OR REPLACE FUNCTION public.get_scheduling_pool_capacity(p_pool_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT COUNT(DISTINCT sd.specialist_id)::integer
      FROM specialist_dealers sd
      JOIN dealers d ON d.id = sd.dealer_id
      WHERE d.scheduling_pool_id = p_pool_id
    ), 0),
    1
  );
$$;

COMMENT ON FUNCTION public.get_scheduling_pool_capacity(uuid) IS
  'Max concurrent appointments in a scheduling pool = specialist count (minimum 1).';

CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_duration_minutes INTEGER := 75;
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  pool_id uuid;
  pool_capacity INTEGER;
  overlapping_count INTEGER;
BEGIN
  IF COALESCE(NEW.is_external, false) = true THEN
    RETURN NEW;
  END IF;

  IF NEW.dealer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT scheduling_pool_id INTO pool_id FROM dealers WHERE id = NEW.dealer_id;

  IF pool_id IS NULL THEN
    SELECT id INTO pool_id FROM scheduling_pools WHERE code = 'DEFAULT' LIMIT 1;
    IF pool_id IS NOT NULL THEN
      UPDATE dealers SET scheduling_pool_id = pool_id WHERE id = NEW.dealer_id;
    END IF;
  END IF;

  IF pool_id IS NULL THEN
    RETURN NEW;
  END IF;

  pool_capacity := public.get_scheduling_pool_capacity(pool_id);
  new_start := NEW.appointment_date;
  new_end := NEW.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL;

  SELECT COUNT(*)
  INTO overlapping_count
  FROM demands d
  JOIN dealers dl ON dl.id = d.dealer_id
  WHERE d.status != 'cancelled'
    AND COALESCE(d.is_external, false) = false
    AND dl.scheduling_pool_id = pool_id
    AND d.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND d.appointment_date < new_end
    AND (d.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) > new_start;

  IF overlapping_count >= pool_capacity THEN
    RAISE EXCEPTION 'This time slot is fully booked for your service area. Please select another time.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_appointment_overlap() IS
  'Pool-scoped overlap: blocks only when concurrent bookings in the same scheduling pool reach specialist capacity.';
