-- Add HR, IT as platform roles (like Sales, Finance)
-- Specialist displays as "Technical Support" in UI
-- Replaces department-based approach with role-based approach

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'hr';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'it';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Remove department_id from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS department_id;

-- Drop departments table (roles replace it)
DROP TABLE IF EXISTS departments CASCADE;
