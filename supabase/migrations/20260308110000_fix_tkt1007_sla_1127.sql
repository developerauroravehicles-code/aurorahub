-- Fix TKT-1007: SLA should be 11:27 AM PT, not 9:27 PM PT.
-- 11:27 AM Pacific (Mar 17, 2026) = 18:27 UTC
UPDATE it_tickets
SET sla_due_at = '2026-03-17T18:27:00.000Z'
WHERE ticket_number = 'TKT-1007'
  AND sla_due_at IS NOT NULL;
