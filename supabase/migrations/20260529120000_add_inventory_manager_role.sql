-- Add inventory_manager to user_role enum.
-- Must be in its own migration: PostgreSQL requires the new enum value to be
-- committed before it can be referenced (e.g. in RLS policies).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'inventory_manager';
