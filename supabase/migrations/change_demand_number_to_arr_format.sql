-- Change demand_number format from 1001,1002... to ARR{YEAR}XXXXXXX
-- Example: First demand in 2026 = ARR20260000001

-- 1. Drop old trigger, remove default (sequence dependency), then drop sequence
DROP TRIGGER IF EXISTS prevent_demand_number_update_trigger ON demands;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='demands' AND column_name='demand_number') THEN
    EXECUTE 'ALTER TABLE demands ALTER COLUMN demand_number DROP DEFAULT';
  END IF;
END $$;
DROP SEQUENCE IF EXISTS demand_number_seq;

-- 2. Add new text column for ARR format
ALTER TABLE demands ADD COLUMN IF NOT EXISTS demand_number_new text;

-- 3. Backfill existing demands: ARR{YEAR}{7-digit seq per year} by created_at order
DO $$
DECLARE
  r RECORD;
  n_year int;
  n_seq int;
  n_val text;
  prev_year int := 0;
BEGIN
  FOR r IN (
    SELECT id, created_at,
           EXTRACT(YEAR FROM created_at)::int AS yr,
           ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at ASC) AS rn
    FROM demands
    ORDER BY created_at ASC
  )
  LOOP
    n_year := r.yr;
    n_seq := r.rn::int;
    n_val := 'ARR' || n_year::text || LPAD(n_seq::text, 7, '0');
    UPDATE demands SET demand_number_new = n_val WHERE id = r.id;
  END LOOP;
END $$;

-- 4. Remove old column and rename new one
ALTER TABLE demands DROP COLUMN IF EXISTS demand_number;
ALTER TABLE demands RENAME COLUMN demand_number_new TO demand_number;

-- 5. Ensure NOT NULL and UNIQUE
ALTER TABLE demands ALTER COLUMN demand_number SET NOT NULL;
ALTER TABLE demands DROP CONSTRAINT IF EXISTS demands_demand_number_key;
ALTER TABLE demands ADD CONSTRAINT demands_demand_number_key UNIQUE (demand_number);

-- 6. Function: generate ARR{YEAR}XXXXXXX on INSERT (with advisory lock for concurrency)
CREATE OR REPLACE FUNCTION generate_demand_number_arr()
RETURNS TRIGGER AS $$
DECLARE
  n_year int;
  n_next int;
  n_number text;
BEGIN
  IF NEW.demand_number IS NOT NULL AND TRIM(NEW.demand_number) != '' THEN
    RETURN NEW;
  END IF;

  -- Advisory lock to prevent duplicate numbers under concurrent inserts
  PERFORM pg_advisory_xact_lock(hashtext('demand_number_arr'));

  n_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, NOW()));
  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(demand_number, '^ARR[0-9]{4}', ''), '')::int
  ), 0) + 1 INTO n_next
  FROM demands
  WHERE demand_number LIKE 'ARR' || n_year::text || '%';

  n_number := 'ARR' || n_year::text || LPAD(n_next::text, 7, '0');
  NEW.demand_number := n_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. BEFORE INSERT trigger - auto-assign demand_number
DROP TRIGGER IF EXISTS set_demand_number_arr_trigger ON demands;
CREATE TRIGGER set_demand_number_arr_trigger
  BEFORE INSERT ON demands
  FOR EACH ROW
  EXECUTE FUNCTION generate_demand_number_arr();

-- 8. Prevent updates to demand_number
CREATE OR REPLACE FUNCTION prevent_demand_number_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.demand_number IS DISTINCT FROM NEW.demand_number THEN
    RAISE EXCEPTION 'demand_number cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_demand_number_update_trigger ON demands;
CREATE TRIGGER prevent_demand_number_update_trigger
  BEFORE UPDATE ON demands
  FOR EACH ROW
  EXECUTE FUNCTION prevent_demand_number_update();
