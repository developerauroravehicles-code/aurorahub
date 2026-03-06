-- ============================================
-- AURORA HUB COMPREHENSIVE HR SCHEMA
-- Master personnel, Installer Network, Training, Payroll, Compliance, etc.
-- ============================================

-- Enums for personnel / worker types
DO $$ BEGIN
  CREATE TYPE worker_type AS ENUM (
    'employee', 'contractor', 'installer_technician', 'dealer_staff',
    'regional_manager', 'support_staff'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE personnel_status AS ENUM (
    'active', 'suspended', 'onboarding', 'pending_verification'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_type AS ENUM (
    'full_time', 'part_time', 'contract', 'hourly', 'per_installation',
    'commission', 'freelance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE canadian_province AS ENUM (
    'ontario', 'british_columbia', 'alberta', 'quebec', 'manitoba',
    'saskatchewan', 'nova_scotia', 'new_brunswick', 'newfoundland', 'pei', 'yukon', 'nwt', 'nunavut'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE certification_type AS ENUM (
    'dashcam_installation', 'vehicle_electronics', 'safety_training',
    'insurance_compliance', 'customer_service', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM (
    'salary', 'hourly', 'per_installation', 'commission', 'bonus',
    'job_based', 'dealer_commission', 'platform_commission'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE personnel_event_type AS ENUM (
    'hired', 'certified', 'job_assigned', 'performance_review',
    'suspension', 'contract_renewal', 'status_change', 'training_completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Regions (for service areas, provinces)
CREATE TABLE IF NOT EXISTS hr_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  province canadian_province,
  created_at timestamptz DEFAULT now()
);

-- Departments (platform org structure)
CREATE TABLE IF NOT EXISTS hr_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  parent_id uuid REFERENCES hr_departments(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 1. PERSONNEL (Master Registry)
-- ============================================
CREATE TABLE IF NOT EXISTS personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  dealer_id uuid REFERENCES dealers(id) ON DELETE SET NULL,
  worker_id text UNIQUE,
  worker_type worker_type NOT NULL DEFAULT 'employee',
  worker_classification text,
  status personnel_status DEFAULT 'onboarding',
  full_name text NOT NULL,
  avatar_url text,
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  government_id text,
  sin_verified boolean DEFAULT false,
  work_permit_status text,
  driver_license text,
  background_check_status text,
  position text,
  department_id uuid REFERENCES hr_departments(id),
  region_id uuid REFERENCES hr_regions(id),
  assigned_manager_id uuid REFERENCES personnel(id),
  start_date date,
  contract_type contract_type,
  province canadian_province,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personnel_profile_id ON personnel(profile_id);
CREATE INDEX IF NOT EXISTS idx_personnel_dealer_id ON personnel(dealer_id);
CREATE INDEX IF NOT EXISTS idx_personnel_worker_type ON personnel(worker_type);
CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status);
CREATE INDEX IF NOT EXISTS idx_personnel_worker_id ON personnel(worker_id);

-- ============================================
-- 2. INSTALLER PROFILES (Technician Network)
-- ============================================
CREATE TABLE IF NOT EXISTS installer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  service_region_ids uuid[],
  installation_skills text[],
  device_compatibility text[],
  experience_level text,
  customer_rating decimal(3,2) DEFAULT 0,
  dealer_feedback_score decimal(3,2) DEFAULT 0,
  quality_score decimal(3,2) DEFAULT 0,
  completion_rate decimal(5,2) DEFAULT 0,
  installer_status personnel_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installer_service_regions (
  installer_profile_id uuid REFERENCES installer_profiles(id) ON DELETE CASCADE,
  region_id uuid REFERENCES hr_regions(id) ON DELETE CASCADE,
  PRIMARY KEY (installer_profile_id, region_id)
);
ALTER TABLE installer_service_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_manage_installer_service_regions" ON installer_service_regions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));

-- ============================================
-- 3. CERTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS personnel_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  certification_type certification_type NOT NULL,
  name text,
  issue_date date NOT NULL,
  expiry_date date,
  renewal_reminder_sent boolean DEFAULT false,
  document_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personnel_certifications_personnel ON personnel_certifications(personnel_id);
CREATE INDEX IF NOT EXISTS idx_personnel_certifications_expiry ON personnel_certifications(expiry_date);

-- ============================================
-- 4. TRAINING PROGRAMS & MATERIALS
-- ============================================
CREATE TABLE IF NOT EXISTS training_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES training_programs(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text,
  url text,
  content text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personnel_training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(personnel_id, program_id)
);

-- ============================================
-- 5. ONBOARDING TEMPLATES & DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_step_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  document_type text,
  title text,
  document_url text,
  signed_at timestamptz,
  signed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Enhance onboarding_tasks: link to personnel if needed (optional)
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS personnel_id uuid REFERENCES personnel(id) ON DELETE CASCADE;

-- ============================================
-- 6. AVAILABILITY & SCHEDULING
-- ============================================
CREATE TABLE IF NOT EXISTS personnel_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  day_of_week int,
  start_time time,
  end_time time,
  is_available boolean DEFAULT true,
  valid_from date,
  valid_to date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personnel_leave_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 7. PAYROLL & COMPENSATION
-- ============================================
CREATE TABLE IF NOT EXISTS compensation_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  payment_type payment_type NOT NULL,
  amount decimal(12,2),
  currency text DEFAULT 'CAD',
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL,
  currency text DEFAULT 'CAD',
  payment_type payment_type,
  period_start date,
  period_end date,
  status text DEFAULT 'pending',
  paid_at timestamptz,
  invoice_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_personnel ON payment_records(personnel_id);

-- ============================================
-- 8. COMPLIANCE & LEGAL
-- ============================================
CREATE TABLE IF NOT EXISTS compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  document_type text,
  title text,
  province canadian_province,
  document_url text,
  expiry_date date,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 9. PERFORMANCE & QUALITY
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  metric_type text,
  value decimal(10,2),
  period_start date,
  period_end date,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  feedback_type text,
  source text,
  rating decimal(3,2),
  comment text,
  demand_id uuid REFERENCES demands(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  review_date date NOT NULL,
  reviewer_id uuid REFERENCES personnel(id),
  rating decimal(3,2),
  notes text,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 10. EQUIPMENT & ASSETS
-- ============================================
CREATE TABLE IF NOT EXISTS equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  equipment_type_id uuid REFERENCES equipment_types(id),
  item_name text,
  serial_number text,
  assigned_at date NOT NULL,
  returned_at date,
  condition text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 11. PERSONNEL TIMELINE (Event History)
-- ============================================
CREATE TABLE IF NOT EXISTS personnel_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  event_type personnel_event_type NOT NULL,
  title text,
  description text,
  metadata jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personnel_timeline_personnel ON personnel_timeline(personnel_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE hr_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE installer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_step_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_leave_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_timeline ENABLE ROW LEVEL SECURITY;

-- HR and Aurora Manager can manage all HR tables
CREATE POLICY "hr_manage_hr_regions" ON hr_regions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_hr_departments" ON hr_departments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_personnel" ON personnel FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_installer_profiles" ON installer_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_personnel_certifications" ON personnel_certifications FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_training_programs" ON training_programs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_training_materials" ON training_materials FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_personnel_training_completions" ON personnel_training_completions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_onboarding_step_templates" ON onboarding_step_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_onboarding_documents" ON onboarding_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_personnel_availability" ON personnel_availability FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_personnel_leave_blocks" ON personnel_leave_blocks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_compensation_structures" ON compensation_structures FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_payment_records" ON payment_records FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_compliance_documents" ON compliance_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_compliance_checklists" ON compliance_checklists FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_performance_metrics" ON performance_metrics FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_performance_feedback" ON performance_feedback FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_performance_reviews" ON performance_reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_equipment_types" ON equipment_types FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_equipment_assignments" ON equipment_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));
CREATE POLICY "hr_manage_personnel_timeline" ON personnel_timeline FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager')));

-- Anyone can view regions and departments (read-only for dropdowns)
CREATE POLICY "anyone_view_hr_regions" ON hr_regions FOR SELECT USING (true);
CREATE POLICY "anyone_view_hr_departments" ON hr_departments FOR SELECT USING (true);

-- Insert default regions (Canadian provinces)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM hr_regions) = 0 THEN
    INSERT INTO hr_regions (name, code, province) VALUES
      ('Ontario', 'ON', 'ontario'),
      ('British Columbia', 'BC', 'british_columbia'),
      ('Alberta', 'AB', 'alberta'),
      ('Quebec', 'QC', 'quebec');
  END IF;
END $$;

-- Default training programs
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM training_programs) = 0 THEN
    INSERT INTO training_programs (name, description, category) VALUES
      ('Dashcam Installation', 'Basic dashcam installation training', 'technical'),
      ('Vehicle Electrical Systems', 'Vehicle electronics and wiring', 'technical'),
      ('Customer Service', 'Customer interaction and satisfaction', 'soft_skills'),
      ('Safety Procedures', 'Workplace and vehicle safety', 'safety');
  END IF;
END $$;
