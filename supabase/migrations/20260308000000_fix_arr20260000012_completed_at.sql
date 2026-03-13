-- Fix completed_at for ARR20260000012 to 1 March 2026 (Pacific timezone)
-- Complete date and warranty date (complete + 3 years) are derived from completed_at
UPDATE demands
SET completed_at = (timestamp '2026-03-01 00:00:00' AT TIME ZONE 'America/Vancouver')::timestamptz
WHERE demand_number = 'ARR20260000012'
  AND status = 'completed';
