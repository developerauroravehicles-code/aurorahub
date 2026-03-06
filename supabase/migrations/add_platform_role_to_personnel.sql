-- Add platform_role to personnel for platform user roles (Technical Support, Aurora Manager, HR, IT)
-- Replaces/ supplements department_id for role-based identification

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS platform_role text;

COMMENT ON COLUMN personnel.platform_role IS 'Platform role when personnel is a platform user: specialist, aurora_manager, hr, it';
