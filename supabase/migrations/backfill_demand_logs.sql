-- Backfill demand_logs for existing demands that have no process history
-- Inserts inferred log entries based on demand state (created_at, status, assigned users)

-- 1. Demand created - for all demands with no existing logs
INSERT INTO demand_logs (demand_id, actor_id, previous_status, new_status, notes, created_at)
SELECT 
  d.id,
  d.created_by,
  NULL::demand_status,
  'pending_finance'::demand_status,
  'Demand created (historical data)',
  d.created_at
FROM demands d
WHERE NOT EXISTS (SELECT 1 FROM demand_logs dl WHERE dl.demand_id = d.id)
  AND d.created_by IS NOT NULL;

-- 2. Status change logs - for demands that progressed past pending_finance
-- Approved (use updated_at so it's before completed for completed demands)
INSERT INTO demand_logs (demand_id, actor_id, previous_status, new_status, notes, created_at)
SELECT 
  d.id,
  COALESCE(d.assigned_finance_id, d.created_by),
  'pending_finance'::demand_status,
  'approved'::demand_status,
  'Approved (historical data)',
  CASE WHEN d.status = 'completed' 
    THEN COALESCE(d.updated_at, d.created_at + interval '2 minutes') 
    ELSE COALESCE(d.updated_at, d.created_at + interval '1 minute') 
  END
FROM demands d
WHERE NOT EXISTS (
  SELECT 1 FROM demand_logs dl 
  WHERE dl.demand_id = d.id AND dl.new_status = 'approved'
)
AND d.status IN ('approved', 'completed')
AND (d.assigned_finance_id IS NOT NULL OR d.created_by IS NOT NULL);

-- Completed (use updated_at - 1 min so it appears after approved in timeline)
INSERT INTO demand_logs (demand_id, actor_id, previous_status, new_status, notes, created_at)
SELECT 
  d.id,
  COALESCE(d.assigned_specialist_id, d.assigned_finance_id, d.created_by),
  'approved'::demand_status,
  'completed'::demand_status,
  'Completed (historical data)',
  COALESCE(d.updated_at, d.created_at + interval '2 minutes') + interval '1 minute'
FROM demands d
WHERE NOT EXISTS (
  SELECT 1 FROM demand_logs dl 
  WHERE dl.demand_id = d.id AND dl.new_status = 'completed'
)
AND d.status = 'completed'
AND (d.assigned_specialist_id IS NOT NULL OR d.assigned_finance_id IS NOT NULL OR d.created_by IS NOT NULL);

-- Cancelled
INSERT INTO demand_logs (demand_id, actor_id, previous_status, new_status, notes, created_at)
SELECT 
  d.id,
  COALESCE(d.assigned_finance_id, d.created_by),
  'pending_finance'::demand_status,
  'cancelled'::demand_status,
  'Cancelled (historical data)',
  COALESCE(d.updated_at, d.created_at + interval '1 minute')
FROM demands d
WHERE NOT EXISTS (
  SELECT 1 FROM demand_logs dl 
  WHERE dl.demand_id = d.id AND dl.new_status = 'cancelled'
)
AND d.status = 'cancelled'
AND (d.assigned_finance_id IS NOT NULL OR d.created_by IS NOT NULL);
