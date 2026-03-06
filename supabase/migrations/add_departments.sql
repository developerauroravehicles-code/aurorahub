-- Departments: Aurora platform internal organizational units.
-- Only relevant for platform users (profiles with dealer_id = NULL).

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view departments" ON departments;
CREATE POLICY "Anyone can view departments"
  ON departments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Aurora Managers can manage departments" ON departments;
CREATE POLICY "Aurora Managers can manage departments"
  ON departments FOR ALL
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

-- Add department_id to profiles (for platform staff)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON profiles(department_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_departments_updated_at();

-- Seed default platform departments (Aurora Manager and platform staff belong to these)
INSERT INTO departments (code, name, description) VALUES
  ('HR', 'Human Resources', 'Personel, işe alım, performans'),
  ('IT', 'Information Technology', 'Bilgi teknolojileri, sistem yönetimi'),
  ('TECH', 'Technical Support', 'Installation, service, technical support')
ON CONFLICT (code) DO NOTHING;
