-- Add demand_number: sequential ID (1001, 1002, ...) for human-readable demand reference
-- Auto-assigned on INSERT, read-only (never editable by users)

-- 1. Create sequence starting at 1001
CREATE SEQUENCE IF NOT EXISTS demand_number_seq START WITH 1001;

-- 2. Add column (nullable initially for backfill)
ALTER TABLE demands ADD COLUMN IF NOT EXISTS demand_number integer UNIQUE;

-- 3. Backfill existing demands in created_at order (only if any have NULL)
DO $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*) INTO cnt FROM demands WHERE demand_number IS NULL;
  IF cnt > 0 THEN
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
      FROM demands
      WHERE demand_number IS NULL
    )
    UPDATE demands d
    SET demand_number = (SELECT (1000 + o.rn) FROM ordered o WHERE o.id = d.id)
    FROM ordered o
    WHERE d.id = o.id;
  END IF;
END $$;

-- 4. Set sequence to max+1 so new inserts get next number
SELECT setval('demand_number_seq', GREATEST(1001, COALESCE((SELECT MAX(demand_number) FROM demands), 1000) + 1));

-- 5. Add default for new rows and NOT NULL
ALTER TABLE demands ALTER COLUMN demand_number SET DEFAULT nextval('demand_number_seq');
-- Set any remaining NULLs (shouldn't happen) before NOT NULL
UPDATE demands SET demand_number = nextval('demand_number_seq') WHERE demand_number IS NULL;
ALTER TABLE demands ALTER COLUMN demand_number SET NOT NULL;

-- 6. Prevent updates to demand_number (database-level protection)
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
