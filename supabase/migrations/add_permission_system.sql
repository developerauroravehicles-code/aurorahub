-- Permission System: Permission definitions and role-permission mapping
-- Defines all permissions and controls role access across the system.

-- ============================================
-- 1. PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  module_path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- ============================================
-- 2. ROLE_PERMISSIONS (role-permission mapping)
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role text NOT NULL,
  permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- ============================================
-- 3. SEED: All permissions
-- ============================================
INSERT INTO permissions (code, name, description, category, module_path) VALUES
-- Organization (Active Directory style)
('org.user.view', 'User Management - View', 'View and manage platform users', 'Organization', '/dashboard/system-management/user'),
('org.user.create', 'User Management - Create', 'Create new platform users', 'Organization', '/dashboard/system-management/user'),
('org.user.update', 'User Management - Update', 'Update platform users', 'Organization', '/dashboard/system-management/user'),
('org.user.delete', 'User Management - Delete', 'Delete platform users', 'Organization', '/dashboard/system-management/user'),
('org.employees.view', 'Employees - View', 'View employee list and details', 'Organization', '/dashboard/admin/employees'),
('org.employees.manage', 'Employees - Manage', 'Manage employees and specialist-dealer assignments', 'Organization', '/dashboard/admin/employees'),

-- System
('sys.database.view', 'Database - View', 'View database/profiles overview', 'System', '/dashboard/system-management/database'),
('sys.api.view', 'API - View', 'View API configuration', 'System', '/dashboard/system-management/api'),
('sys.automation.manage', 'Automation - Manage', 'Create and manage scheduled automations', 'System', '/dashboard/system-management/automation'),
('sys.mail.view', 'Mail Settings - View', 'View mail configuration', 'System', '/dashboard/system-management/mail-settings'),
('sys.mail.save', 'Mail Settings - Save', 'Save mail configuration', 'System', '/dashboard/system-management/mail-settings'),
('sys.logo.manage', 'Logo - Manage', 'Upload and manage platform logo', 'System', '/dashboard/system-management/logo'),
('sys.whitepaper.view', 'Whitepaper - View', 'View and download whitepaper', 'System', '/dashboard/system-management/whitepaper'),

-- Communication
('comm.sms.view', 'SMS - View Settings', 'View SMS configuration', 'Communication', '/dashboard/system-management/sms'),
('comm.sms.save', 'SMS - Save Settings', 'Save SMS configuration', 'Communication', '/dashboard/system-management/sms'),
('comm.sms.logs', 'SMS - View Logs', 'View SMS sending logs', 'Communication', '/dashboard/system-management/sms'),
('comm.sms.send', 'SMS - Send Manual', 'Send manual SMS messages', 'Communication', '/dashboard/system-management/sms'),

-- Dealers
('dealer.view', 'Dealers - View', 'View dealer list and details', 'Dealers', '/dashboard/system-management/dealer'),
('dealer.manage', 'Dealers - Manage', 'Manage dealers, regions, cameras', 'Dealers', '/dashboard/system-management/dealer'),
('dealer.region.manage', 'Region - Manage', 'Manage region codes and timezones', 'Dealers', '/dashboard/system-management/region'),
('dealer.calendar.manage', 'Calendar - Manage', 'Manage dealer calendar settings and blocks', 'Dealers', '/dashboard/system-management/calendar'),
('dealer.cameras.manage', 'Cameras - Manage', 'Manage camera models and dealer cameras', 'Dealers', '/dashboard/system-management/cameras'),

-- Service Desk
('servicedesk.view', 'Service Desk - View', 'View tickets, incidents, changes, releases', 'Service Desk', '/dashboard/system-management/service-desk'),
('servicedesk.manage', 'Service Desk - Manage', 'Create and manage all Service Desk items', 'Service Desk', '/dashboard/system-management/service-desk'),

-- Logs
('logs.sms', 'Logs - SMS', 'View SMS logs', 'Logs', '/dashboard/system-management/logs'),
('logs.demand', 'Logs - Demand', 'View demand logs', 'Logs', '/dashboard/system-management/logs'),
('logs.mail', 'Logs - Mail', 'View mail logs', 'Logs', '/dashboard/system-management/logs'),

-- Permissions Management (meta)
('permissions.view', 'Permissions - View', 'View permission definitions and role assignments', 'Permissions', '/dashboard/system-management/permissions'),
('permissions.manage', 'Permissions - Manage', 'Assign permissions to roles', 'Permissions', '/dashboard/system-management/permissions')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 4. DEFAULT ROLE ASSIGNMENTS (preserve existing behavior)
-- aurora_manager and it: all system-management permissions
-- ============================================
INSERT INTO role_permissions (role, permission_code)
SELECT 'aurora_manager', code FROM permissions
ON CONFLICT (role, permission_code) DO NOTHING;

INSERT INTO role_permissions (role, permission_code)
SELECT 'it', code FROM permissions
ON CONFLICT (role, permission_code) DO NOTHING;

-- HR: org.employees, personnel, compliance, leave, training, etc. (ayrı HR modülü - ileride eklenebilir)
-- Sales, Finance, Specialist: kendi modülleri (dealer_id bazlı - şimdilik role_permissions dışında)

-- ============================================
-- RLS
-- ============================================
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the permissions list (for permission checks)
CREATE POLICY "permissions_read_all" ON permissions FOR SELECT TO authenticated USING (true);

-- Only aurora_manager and it can read/write role_permissions
CREATE POLICY "role_permissions_manage" ON role_permissions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('aurora_manager', 'it')));
