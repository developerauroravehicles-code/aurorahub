-- IT Service Desk / Helpdesk
-- Ticket Management, Incident Management, Change Management, Release Management

-- ============================================
-- 1. IT TICKETS
-- ============================================
CREATE TABLE IF NOT EXISTS it_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN (
    'bug_report', 'feature_request', 'system_issue', 'access_request',
    'integration_request', 'security_incident', 'other'
  )),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'escalated', 'resolved', 'closed')),
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_it_tickets_status ON it_tickets(status);
CREATE INDEX IF NOT EXISTS idx_it_tickets_assigned ON it_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_it_tickets_category ON it_tickets(category);
CREATE INDEX IF NOT EXISTS idx_it_tickets_priority ON it_tickets(priority);

-- Ticket number sequence (via trigger)
CREATE SEQUENCE IF NOT EXISTS it_ticket_number_seq START 1000;
CREATE OR REPLACE FUNCTION set_it_ticket_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || nextval('it_ticket_number_seq')::text;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_it_tickets_number ON it_tickets;
CREATE TRIGGER trg_it_tickets_number BEFORE INSERT ON it_tickets FOR EACH ROW EXECUTE FUNCTION set_it_ticket_number();

-- ============================================
-- 2. IT INCIDENTS
-- ============================================
CREATE TABLE IF NOT EXISTS it_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number text UNIQUE,
  title text NOT NULL,
  description text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  impact_scope text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'identified', 'resolving', 'resolved', 'closed')),
  root_cause text,
  timeline jsonb DEFAULT '[]',
  escalation_matrix text,
  resolution_notes text,
  post_mortem text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_it_incidents_status ON it_incidents(status);
CREATE INDEX IF NOT EXISTS idx_it_incidents_severity ON it_incidents(severity);

CREATE SEQUENCE IF NOT EXISTS it_incident_number_seq START 1000;
CREATE OR REPLACE FUNCTION set_it_incident_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.incident_number IS NULL OR NEW.incident_number = '' THEN
    NEW.incident_number := 'INC-' || nextval('it_incident_number_seq')::text;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_it_incidents_number ON it_incidents;
CREATE TRIGGER trg_it_incidents_number BEFORE INSERT ON it_incidents FOR EACH ROW EXECUTE FUNCTION set_it_incident_number();

-- ============================================
-- 3. IT CHANGES (Change Management)
-- ============================================
CREATE TABLE IF NOT EXISTS it_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_number text UNIQUE,
  title text NOT NULL,
  description text,
  change_type text NOT NULL CHECK (change_type IN (
    'feature_deployment', 'config_change', 'database_migration',
    'integration_update', 'hotfix', 'other'
  )),
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'in_progress', 'deployed', 'rolled_back', 'cancelled')),
  approval_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approval_at timestamptz,
  scheduled_at timestamptz,
  deployed_at timestamptz,
  rollback_plan text,
  rollback_executed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_it_changes_status ON it_changes(status);

CREATE SEQUENCE IF NOT EXISTS it_change_number_seq START 1000;
CREATE OR REPLACE FUNCTION set_it_change_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.change_number IS NULL OR NEW.change_number = '' THEN
    NEW.change_number := 'CHG-' || nextval('it_change_number_seq')::text;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_it_changes_number ON it_changes;
CREATE TRIGGER trg_it_changes_number BEFORE INSERT ON it_changes FOR EACH ROW EXECUTE FUNCTION set_it_change_number();

-- ============================================
-- 4. IT RELEASES
-- ============================================
CREATE TABLE IF NOT EXISTS it_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  build_number text,
  release_notes text,
  environment text NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'deployed', 'rolled_back', 'cancelled')),
  deployed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_it_releases_environment ON it_releases(environment);
CREATE INDEX IF NOT EXISTS idx_it_releases_version ON it_releases(version);

-- ============================================
-- 5. KNOWLEDGE BASE
-- ============================================
CREATE TABLE IF NOT EXISTS it_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  category text CHECK (category IN ('api_docs', 'architecture', 'deployment', 'troubleshooting', 'faq', 'other')),
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_it_knowledge_category ON it_knowledge_base(category);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE it_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_service_desk_manage_tickets" ON it_tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

CREATE POLICY "it_service_desk_manage_incidents" ON it_incidents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

CREATE POLICY "it_service_desk_manage_changes" ON it_changes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

CREATE POLICY "it_service_desk_manage_releases" ON it_releases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

CREATE POLICY "it_service_desk_manage_knowledge" ON it_knowledge_base FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

-- Allow platform users to create tickets (request support)
CREATE POLICY "platform_users_create_tickets" ON it_tickets FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND dealer_id IS NULL)
  );

CREATE POLICY "platform_users_view_own_tickets" ON it_tickets FOR SELECT
  USING (
    requested_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it'))
  );
