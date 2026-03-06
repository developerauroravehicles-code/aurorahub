-- HR tables: leave_requests, recruitment_positions, onboarding_tasks
-- Canada-compatible leave types (vacation, sick, parental, etc.)

-- Leave type enum (Canada-compatible)
DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM ('vacation', 'sick', 'personal', 'bereavement', 'parental', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Leave request status
DO $$ BEGIN
  CREATE TYPE leave_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Recruitment position status
DO $$ BEGIN
  CREATE TYPE recruitment_position_status AS ENUM ('open', 'interviewing', 'offer', 'filled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Onboarding task status
DO $$ BEGIN
  CREATE TYPE onboarding_task_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- leave_requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type leave_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status leave_request_status DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_profile_id ON leave_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- recruitment_positions
CREATE TABLE IF NOT EXISTS recruitment_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  role text NOT NULL,
  dealer_id uuid REFERENCES dealers(id) ON DELETE SET NULL,
  status recruitment_position_status DEFAULT 'open',
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  filled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  filled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_recruitment_positions_status ON recruitment_positions(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_positions_created_at ON recruitment_positions(created_at);

-- onboarding_tasks
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status onboarding_task_status DEFAULT 'pending',
  due_date date,
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_profile_id ON onboarding_tasks(profile_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_status ON onboarding_tasks(status);

-- RLS for leave_requests
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can manage leave_requests"
  ON leave_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr'
    )
  );

-- Allow users to see their own leave requests
CREATE POLICY "Users can view own leave_requests"
  ON leave_requests FOR SELECT
  USING (profile_id = auth.uid());

-- RLS for recruitment_positions
ALTER TABLE recruitment_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can manage recruitment_positions"
  ON recruitment_positions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr'
    )
  );

-- RLS for onboarding_tasks
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can manage onboarding_tasks"
  ON onboarding_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr'
    )
  );
