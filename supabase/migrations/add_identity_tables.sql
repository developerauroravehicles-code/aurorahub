-- IDENTITY: Audit Log, User Groups, Group Members
-- Tables for comprehensive Identity management

-- ============================================
-- 1. IDENTITY AUDIT LOG (Login / Auth events)
-- ============================================
CREATE TABLE IF NOT EXISTS identity_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'logout', 'password_reset', 'role_change')),
  email text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_audit_user ON identity_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_audit_created ON identity_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_audit_event ON identity_audit_log(event_type);

-- ============================================
-- 2. USER GROUPS
-- ============================================
CREATE TABLE IF NOT EXISTS user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================
-- 3. GROUP MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS user_group_members (
  group_id uuid REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON user_group_members(user_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE identity_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_members ENABLE ROW LEVEL SECURITY;

-- Audit log: login_success = authenticated user inserts own; login_failed = unauthenticated insert
CREATE POLICY "identity_audit_insert" ON identity_audit_log FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND event_type = 'login_failed' AND user_id IS NULL)
  );

CREATE POLICY "identity_audit_select_admin" ON identity_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

-- Groups: only aurora_manager, it
CREATE POLICY "user_groups_manage" ON user_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

CREATE POLICY "user_group_members_manage" ON user_group_members FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));

-- Identity permissions (if permissions table exists)
INSERT INTO permissions (code, name, description, category, module_path) VALUES
('identity.sessions.view', 'Sessions - View', 'View login/audit log', 'Identity', '/dashboard/system-management/sessions'),
('identity.groups.manage', 'Groups - Manage', 'Create and manage user groups', 'Identity', '/dashboard/system-management/groups')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role, permission_code) VALUES
('aurora_manager', 'identity.sessions.view'),
('aurora_manager', 'identity.groups.manage'),
('it', 'identity.sessions.view'),
('it', 'identity.groups.manage')
ON CONFLICT (role, permission_code) DO NOTHING;
