-- Fix SLA times for existing tickets: old form stored datetime-local as UTC.
-- Reinterpret stored values as Pacific Time and convert to correct UTC.
-- Only affects tickets created/edited before the PT fix (form now uses ptDatetimeLocalToISO).
UPDATE it_tickets
SET sla_due_at = (
  (sla_due_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Vancouver'
)
WHERE sla_due_at IS NOT NULL;
