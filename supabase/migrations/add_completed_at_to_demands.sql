-- Add completed_at to demands: timestamp when demand was marked as completed (status = 'completed')
-- Used for Invoice Complete Date instead of updated_at (which changes on any edit)

ALTER TABLE demands ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill: for existing completed demands, set completed_at from demand_logs or updated_at
UPDATE demands d
SET completed_at = COALESCE(
  (SELECT dl.created_at FROM demand_logs dl
   WHERE dl.demand_id = d.id AND dl.new_status = 'completed'
   ORDER BY dl.created_at DESC LIMIT 1),
  d.updated_at
)
WHERE d.status = 'completed' AND d.completed_at IS NULL;

-- Trigger: set completed_at when status changes to 'completed'
CREATE OR REPLACE FUNCTION set_completed_at_on_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_completed_at_trigger ON demands;
CREATE TRIGGER set_completed_at_trigger
  BEFORE UPDATE ON demands
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at_on_complete();
