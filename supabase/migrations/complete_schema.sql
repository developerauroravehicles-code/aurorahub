-- ============================================
-- AURORA HUB - COMPLETE DATABASE SCHEMA
-- ============================================
-- This file consolidates all migration files into a single schema
-- Run this entire file in Supabase SQL Editor to set up the complete database
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. ENUMS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('sales', 'finance', 'specialist', 'aurora_manager', 'general_manager');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'demand_status') THEN
    CREATE TYPE demand_status AS ENUM ('pending_finance', 'approved', 'completed', 'cancelled');
  END IF;
END $$;

-- ============================================
-- 3. TABLES
-- ============================================

-- Dealers Table
CREATE TABLE IF NOT EXISTS dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  address text,
  logo_url text,
  created_at timestamptz DEFAULT now()
);

-- Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES dealers(id),
  role user_role DEFAULT 'sales',
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Demands Table (Appointments)
CREATE TABLE IF NOT EXISTS demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES profiles(id),
  dealer_id uuid REFERENCES dealers(id),
  
  -- Customer Info
  customer_firstname text NOT NULL,
  customer_lastname text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  
  -- Vehicle Info
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year int NOT NULL,
  stock_number text,
  camera_model text NOT NULL,
  
  -- Appointment Info
  appointment_date timestamptz NOT NULL,
  status demand_status DEFAULT 'pending_finance',
  
  -- Specialist Assignment
  assigned_specialist_id uuid REFERENCES profiles(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add assigned_specialist_id column if table exists but column doesn't
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'demands') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'demands' 
      AND column_name = 'assigned_specialist_id'
    ) THEN
      ALTER TABLE demands ADD COLUMN assigned_specialist_id uuid REFERENCES profiles(id);
    END IF;
  END IF;
END $$;

-- Add assigned_finance_id column if table exists but column doesn't
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'demands') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'demands' 
      AND column_name = 'assigned_finance_id'
    ) THEN
      ALTER TABLE demands ADD COLUMN assigned_finance_id uuid REFERENCES profiles(id);
    END IF;
  END IF;
END $$;

-- Add stock_number column if table exists but column doesn't
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'demands') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'demands' 
      AND column_name = 'stock_number'
    ) THEN
      ALTER TABLE demands ADD COLUMN stock_number text;
    END IF;
  END IF;
END $$;

-- Demand Logs Table (Audit Trail)
CREATE TABLE IF NOT EXISTS demand_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid REFERENCES demands(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id),
  previous_status demand_status,
  new_status demand_status,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Camera Models Table
CREATE TABLE IF NOT EXISTS camera_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  stock_quantity int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add stock_quantity column if table exists but column doesn't
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'camera_models') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'camera_models' 
      AND column_name = 'stock_quantity'
    ) THEN
      ALTER TABLE camera_models ADD COLUMN stock_quantity int DEFAULT 0;
    END IF;
  END IF;
END $$;

-- Dealer Cameras Junction Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS dealer_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  camera_model_id uuid NOT NULL REFERENCES camera_models(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(dealer_id, camera_model_id)
);

-- Timezones Table
CREATE TABLE IF NOT EXISTS timezones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE, -- e.g., "America/Vancouver", "America/Toronto"
  display_name text NOT NULL, -- e.g., "Pacific Time (PT)", "Eastern Time (ET)"
  utc_offset text NOT NULL, -- e.g., "-08:00", "-05:00"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Region Codes Table
CREATE TABLE IF NOT EXISTS region_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  timezone_id uuid REFERENCES timezones(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add region_code_id column to dealers table if it doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dealers') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'dealers' 
      AND column_name = 'region_code_id'
    ) THEN
      ALTER TABLE dealers ADD COLUMN region_code_id uuid REFERENCES region_codes(id);
    END IF;
  END IF;
END $$;

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE timezones ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. DROP EXISTING POLICIES (Clean Slate)
-- ============================================
DROP POLICY IF EXISTS "Dealers are viewable by everyone" ON dealers;
DROP POLICY IF EXISTS "Aurora Managers can manage dealers" ON dealers;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Sales can create demands" ON demands;
DROP POLICY IF EXISTS "Users can view demands from their dealer" ON demands;
DROP POLICY IF EXISTS "Users can view demands" ON demands;
DROP POLICY IF EXISTS "Finance and Managers can update demands" ON demands;
DROP POLICY IF EXISTS "Specialists can update assigned demands" ON demands;
DROP POLICY IF EXISTS "Authenticated users can manage system settings" ON system_settings;
DROP POLICY IF EXISTS "Aurora Managers can manage system settings" ON system_settings;
DROP POLICY IF EXISTS "Camera models are viewable by everyone" ON camera_models;
DROP POLICY IF EXISTS "Aurora Managers can manage camera models" ON camera_models;
DROP POLICY IF EXISTS "Dealer cameras are viewable by everyone" ON dealer_cameras;
DROP POLICY IF EXISTS "Aurora Managers can manage dealer cameras" ON dealer_cameras;
DROP POLICY IF EXISTS "Region codes are viewable by everyone" ON region_codes;
DROP POLICY IF EXISTS "Aurora Managers can manage region codes" ON region_codes;

-- ============================================
-- 6. CREATE POLICIES
-- ============================================

-- Dealers: Viewable by all authenticated users
CREATE POLICY "Dealers are viewable by everyone" 
ON dealers FOR SELECT 
TO authenticated 
USING (true);

-- Dealers: Aurora Managers can manage (INSERT, UPDATE, DELETE)
CREATE POLICY "Aurora Managers can manage dealers"
ON dealers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

-- Profiles: Viewable by all authenticated users
CREATE POLICY "Profiles are viewable by everyone" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Demands: Sales can CREATE demands
-- IMPORTANT: This policy allows sales users to create demands
-- Frontend sends: created_by = profile.id (which equals auth.uid())
-- This policy ONLY checks role, NOT created_by or dealer_id
-- This makes the policy more flexible and avoids RLS errors
CREATE POLICY "Sales can create demands" 
ON demands FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'sales'
  )
);

-- Demands: Users can VIEW demands from their dealer or managers can view all
CREATE POLICY "Users can view demands from their dealer" 
ON demands FOR SELECT 
TO authenticated 
USING (
  dealer_id IN (
    SELECT dealer_id FROM profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('finance', 'specialist', 'aurora_manager', 'general_manager')
  )
);

-- Demands: Finance and Managers can UPDATE demands
CREATE POLICY "Finance and Managers can update demands" 
ON demands FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('finance', 'aurora_manager', 'general_manager')
  )
);

-- Demands: Specialists can UPDATE assigned demands
CREATE POLICY "Specialists can update assigned demands" 
ON demands FOR UPDATE 
TO authenticated 
USING (
  assigned_specialist_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'specialist'
  )
);

-- System Settings: All authenticated users can manage (admin page uses service role anyway)
CREATE POLICY "Authenticated users can manage system settings"
ON system_settings FOR ALL
TO authenticated
USING (true);

-- Camera Models: Viewable by all authenticated users (only active ones)
CREATE POLICY "Camera models are viewable by everyone"
ON camera_models FOR SELECT
TO authenticated
USING (is_active = true);

-- Camera Models: Aurora Managers can manage
CREATE POLICY "Aurora Managers can manage camera models"
ON camera_models FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

-- Dealer Cameras: Viewable by all authenticated users
CREATE POLICY "Dealer cameras are viewable by everyone"
ON dealer_cameras FOR SELECT
TO authenticated
USING (true);

-- Dealer Cameras: Aurora Managers can manage
CREATE POLICY "Aurora Managers can manage dealer cameras"
ON dealer_cameras FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

-- Region Codes: Viewable by all authenticated users
CREATE POLICY "Region codes are viewable by everyone" 
ON region_codes FOR SELECT 
TO authenticated 
USING (true);

-- Region Codes: Aurora Managers can manage
CREATE POLICY "Aurora Managers can manage region codes"
ON region_codes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'aurora_manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'aurora_manager'
  )
);

-- Timezones: Viewable by everyone
CREATE POLICY "Timezones are viewable by everyone"
ON timezones FOR SELECT
TO authenticated
USING (true);

-- Timezones: Aurora Managers can manage
CREATE POLICY "Aurora Managers can manage timezones"
ON timezones FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'aurora_manager'
  )
);

-- ============================================
-- 7. FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ============================================
-- 8. TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
BEFORE UPDATE ON profiles
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_demands_updated_at ON demands;
CREATE TRIGGER update_demands_updated_at 
BEFORE UPDATE ON demands
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_models_updated_at ON camera_models;
CREATE TRIGGER update_camera_models_updated_at
BEFORE UPDATE ON camera_models
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- Insert default timezones
INSERT INTO timezones (name, display_name, utc_offset) VALUES
  ('America/Vancouver', 'Pacific Time (PT)', '-08:00'),
  ('America/Edmonton', 'Mountain Time (MT)', '-07:00'),
  ('America/Winnipeg', 'Central Time (CT)', '-06:00'),
  ('America/Toronto', 'Eastern Time (ET)', '-05:00'),
  ('America/Halifax', 'Atlantic Time (AT)', '-04:00'),
  ('America/St_Johns', 'Newfoundland Time (NT)', '-03:30')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_region_codes_timezone_id ON region_codes(timezone_id);
CREATE INDEX IF NOT EXISTS idx_timezones_name ON timezones(name);

-- ============================================
-- 9. APPOINTMENT OVERLAP PREVENTION
-- ============================================

-- Create a function to check for overlapping appointments
CREATE OR REPLACE FUNCTION check_appointment_overlap()
RETURNS TRIGGER AS $$
DECLARE
  appointment_duration_minutes INTEGER := 75; -- 1 hour 15 minutes
  new_start TIMESTAMPTZ;
  new_end TIMESTAMPTZ;
  overlapping_count INTEGER;
BEGIN
  -- Calculate the start and end times for the new appointment
  new_start := NEW.appointment_date;
  new_end := NEW.appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL;
  
  -- Check for any overlapping appointments (excluding cancelled ones and the current row if updating)
  SELECT COUNT(*)
  INTO overlapping_count
  FROM demands
  WHERE status != 'cancelled'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid) -- Exclude current row on update
    AND appointment_date < new_end
    AND (appointment_date + (appointment_duration_minutes || ' minutes')::INTERVAL) > new_start;
  
  -- If there's an overlap, raise an error
  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'This time slot is already booked. Please select another time.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check overlap before insert or update
DROP TRIGGER IF EXISTS prevent_overlapping_appointments_trigger ON demands;
CREATE TRIGGER prevent_overlapping_appointments_trigger
  BEFORE INSERT OR UPDATE OF appointment_date, status ON demands
  FOR EACH ROW
  WHEN (NEW.status != 'cancelled') -- Only check for non-cancelled appointments
  EXECUTE FUNCTION check_appointment_overlap();

-- Add index for better performance on appointment_date queries
CREATE INDEX IF NOT EXISTS idx_demands_appointment_date_status 
ON demands(appointment_date, status) 
WHERE status != 'cancelled';

-- ============================================
-- 10. SPECIALIST-DEALER JUNCTION TABLE
-- ============================================

-- Create junction table for specialist-dealer many-to-many relationship
CREATE TABLE IF NOT EXISTS specialist_dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(specialist_id, dealer_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_specialist_dealers_specialist_id ON specialist_dealers(specialist_id);
CREATE INDEX IF NOT EXISTS idx_specialist_dealers_dealer_id ON specialist_dealers(dealer_id);

-- RLS Policies
ALTER TABLE specialist_dealers ENABLE ROW LEVEL SECURITY;

-- Everyone can view specialist-dealer assignments
CREATE POLICY "Anyone can view specialist-dealer assignments"
  ON specialist_dealers
  FOR SELECT
  USING (true);

-- Only Aurora Managers can manage specialist-dealer assignments
CREATE POLICY "Aurora Managers can manage specialist-dealer assignments"
  ON specialist_dealers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'aurora_manager'
    )
  );

SELECT '✅ Schema created successfully! Tables: dealers, profiles, demands, demand_logs, system_settings, camera_models, dealer_cameras, region_codes, timezones' as status;

-- ============================================
-- DEBUG/UTILITY QUERIES (Optional - Commented out)
-- ============================================
-- Uncomment below sections if you need to debug or check the database state

/*
-- Check current authenticated user and profile
SELECT 
  'Current User Info' as check_type,
  auth.uid() as user_id,
  p.id as profile_id,
  p.full_name,
  p.role,
  p.dealer_id,
  CASE 
    WHEN p.id IS NULL THEN '❌ NO PROFILE - Create user in /admin page'
    WHEN p.role != 'sales' THEN '❌ WRONG ROLE - Role is: ' || p.role::text
    ELSE '✅ OK - User has sales role'
  END as status
FROM profiles p
WHERE p.id = auth.uid();

-- Check all policies on demands table
SELECT 
  'Demands Policies' as check_type,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN '✅ INSERT policy exists'
    WHEN cmd = 'SELECT' THEN '✅ SELECT policy exists'
    WHEN cmd = 'UPDATE' THEN '✅ UPDATE policy exists'
    ELSE '❓ Unknown'
  END as status
FROM pg_policies 
WHERE tablename = 'demands'
ORDER BY cmd, policyname;

-- Check if profiles table has any sales users
SELECT 
  'Sales Users Check' as check_type,
  COUNT(*) as total_sales_users,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO SALES USERS - Create one in /admin page'
    ELSE '✅ Found ' || COUNT(*)::text || ' sales user(s)'
  END as status
FROM profiles
WHERE role = 'sales';

-- Test policy condition for current user
SELECT 
  'Policy Condition Test' as check_step,
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'sales'
  ) as policy_condition_passes,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'sales'
    ) THEN '✅ Policy condition PASSES - INSERT should work'
    ELSE '❌ Policy condition FAILS - Cannot INSERT'
  END as status;
*/

