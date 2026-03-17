-- Set sla_due_at from created_at + priority-based hours on ticket creation.
-- critical=4h, high=8h, medium=24h, low=48h

-- Backfill existing tickets that have no sla_due_at
UPDATE it_tickets
SET sla_due_at = created_at + (
  CASE priority
    WHEN 'critical' THEN interval '4 hours'
    WHEN 'high' THEN interval '8 hours'
    WHEN 'medium' THEN interval '24 hours'
    WHEN 'low' THEN interval '48 hours'
    ELSE interval '24 hours'
  END
)
WHERE sla_due_at IS NULL;

CREATE OR REPLACE FUNCTION set_ticket_sla_from_creation() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := NEW.created_at + (
      CASE NEW.priority
        WHEN 'critical' THEN interval '4 hours'
        WHEN 'high' THEN interval '8 hours'
        WHEN 'medium' THEN interval '24 hours'
        WHEN 'low' THEN interval '48 hours'
        ELSE interval '24 hours'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_sla_from_creation ON it_tickets;
CREATE TRIGGER trg_ticket_sla_from_creation
  BEFORE INSERT ON it_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_sla_from_creation();
