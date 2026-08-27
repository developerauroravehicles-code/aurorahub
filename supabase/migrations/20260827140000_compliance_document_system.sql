-- HR Compliance Document System: templates, assignments, audit events

DO $$ BEGIN
  CREATE TYPE compliance_doc_category AS ENUM ('onboarding', 'offboarding');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance_interaction_type AS ENUM ('upload', 'acknowledge', 'docusign', 'hr_generated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE personnel_document_status AS ENUM (
    'assigned',
    'generated',
    'pending_ack',
    'acknowledged',
    'pending_signature',
    'signed',
    'uploaded',
    'verified',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance_document_event_type AS ENUM (
    'generated',
    'viewed',
    'scroll_completed',
    'acknowledged',
    'uploaded',
    'docusign_sent',
    'docusign_signed',
    'hr_verified',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS compliance_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category compliance_doc_category NOT NULL,
  interaction_type compliance_interaction_type NOT NULL,
  province canadian_province,
  template_version int NOT NULL DEFAULT 1,
  template_drive_file_id text,
  template_body text,
  requires_scroll_ack boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personnel_document_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES compliance_document_templates(id) ON DELETE RESTRICT,
  template_version int NOT NULL,
  status personnel_document_status NOT NULL DEFAULT 'assigned',
  drive_file_id text,
  drive_web_view_link text,
  drive_folder_path text,
  content_hash text,
  acknowledged_at timestamptz,
  acknowledged_ip text,
  ack_user_agent text,
  scroll_completed_at timestamptz,
  docusign_envelope_id text,
  docusign_status text,
  signed_at timestamptz,
  signed_drive_file_id text,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  verified_at timestamptz,
  verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (personnel_id, template_id)
);

CREATE TABLE IF NOT EXISTS compliance_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES personnel_document_assignments(id) ON DELETE CASCADE,
  event_type compliance_document_event_type NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pda_personnel_id ON personnel_document_assignments(personnel_id);
CREATE INDEX IF NOT EXISTS idx_pda_template_id ON personnel_document_assignments(template_id);
CREATE INDEX IF NOT EXISTS idx_pda_status ON personnel_document_assignments(status);
CREATE INDEX IF NOT EXISTS idx_cde_assignment_id ON compliance_document_events(assignment_id);
CREATE INDEX IF NOT EXISTS idx_cdt_category ON compliance_document_templates(category);
CREATE INDEX IF NOT EXISTS idx_cdt_active ON compliance_document_templates(is_active);

ALTER TABLE compliance_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_document_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_document_events ENABLE ROW LEVEL SECURITY;

-- HR / Aurora Manager full access
CREATE POLICY hr_manage_compliance_document_templates ON compliance_document_templates
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager', 'it')));

CREATE POLICY hr_manage_personnel_document_assignments ON personnel_document_assignments
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager', 'it')));

CREATE POLICY hr_manage_compliance_document_events ON compliance_document_events
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager', 'it')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('hr', 'aurora_manager', 'it')));

-- Platform employees: read own assignments
CREATE POLICY platform_view_own_document_assignments ON personnel_document_assignments
  FOR SELECT
  USING (
    personnel_id IN (
      SELECT id FROM personnel WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

CREATE POLICY platform_update_own_document_assignments ON personnel_document_assignments
  FOR UPDATE
  USING (
    personnel_id IN (
      SELECT id FROM personnel WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  )
  WITH CHECK (
    personnel_id IN (
      SELECT id FROM personnel WHERE profile_id = auth.uid() AND dealer_id IS NULL
    )
  );

-- Platform employees: read own events; insert via service role / server actions with admin client for ack
CREATE POLICY platform_view_own_document_events ON compliance_document_events
  FOR SELECT
  USING (
    assignment_id IN (
      SELECT pda.id FROM personnel_document_assignments pda
      JOIN personnel p ON p.id = pda.personnel_id
      WHERE p.profile_id = auth.uid() AND p.dealer_id IS NULL
    )
  );

CREATE POLICY platform_insert_own_document_events ON compliance_document_events
  FOR INSERT
  WITH CHECK (
    assignment_id IN (
      SELECT pda.id FROM personnel_document_assignments pda
      JOIN personnel p ON p.id = pda.personnel_id
      WHERE p.profile_id = auth.uid() AND p.dealer_id IS NULL
    )
  );

-- Templates readable by all authenticated (for self portal labels)
CREATE POLICY authenticated_read_compliance_templates ON compliance_document_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Seed BC-focused document templates (English UI; legal text requires counsel review)
INSERT INTO compliance_document_templates (code, name, description, category, interaction_type, province, requires_scroll_ack, sort_order, template_body)
VALUES
  (
    'sin_confirmation',
    'SIN Document / Confirmation',
    'Official Service Canada SIN confirmation document.',
    'onboarding',
    'upload',
    'british_columbia',
    false,
    10,
    E'SIN DOCUMENT / CONFIRMATION\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nDate: {{today_date}}\n\nPlease upload your official SIN confirmation from Service Canada.'
  ),
  (
    'photo_id',
    'Photo ID',
    'Passport, BC Driver''s License, or BCID (front and back).',
    'onboarding',
    'upload',
    'british_columbia',
    false,
    20,
    E'PHOTO ID\n\nEmployee: {{full_name}}\n\nPlease upload a valid government-issued photo ID.'
  ),
  (
    'work_permit',
    'Work Permit / Visa',
    'Valid work permit or study permit if applicable.',
    'onboarding',
    'upload',
    'british_columbia',
    false,
    30,
    E'WORK PERMIT / VISA\n\nEmployee: {{full_name}}\n\nUpload your valid Canadian work or study permit if applicable.'
  ),
  (
    'void_cheque',
    'Void Cheque / Direct Deposit Form',
    'Banking details for payroll direct deposit.',
    'onboarding',
    'upload',
    'british_columbia',
    false,
    40,
    E'VOID CHEQUE / DIRECT DEPOSIT\n\nEmployee: {{full_name}}\nEmail: {{email}}\n\nUpload a void cheque or completed direct deposit authorization form.'
  ),
  (
    'employment_agreement',
    'Employment Offer / Agreement',
    'Primary employment contract with terms of employment.',
    'onboarding',
    'docusign',
    'british_columbia',
    false,
    50,
    E'EMPLOYMENT OFFER / AGREEMENT\n\nThis Employment Agreement is entered into as of {{today_date}} between Aurora Platform and {{full_name}}.\n\nPosition: {{job_title}}\nStart Date: {{start_date}}\nProvince: {{province}}\nAddress: {{address}}\n\nThe employee agrees to the terms and conditions of employment as outlined herein, consistent with the BC Employment Standards Act.'
  ),
  (
    'nda',
    'Non-Disclosure Agreement',
    'Confidentiality and proprietary information protection.',
    'onboarding',
    'docusign',
    'british_columbia',
    false,
    60,
    E'NON-DISCLOSURE AGREEMENT\n\nEmployee: {{full_name}}\nDate: {{today_date}}\n\nThe employee agrees to protect confidential company information, customer data, and trade secrets during and after employment.'
  ),
  (
    'handbook_policy_ack',
    'Employee Handbook & Policy Acknowledgment',
    'WorkSafeBC, anti-harassment, and IT security policies.',
    'onboarding',
    'acknowledge',
    'british_columbia',
    true,
    70,
    E'EMPLOYEE HANDBOOK & POLICY ACKNOWLEDGMENT\n\nEmployee: {{full_name}}\nDate: {{today_date}}\n\nI acknowledge that I have received, read, and understood the company Employee Handbook including:\n\n1. WorkSafeBC health and safety requirements\n2. Anti-harassment and workplace conduct policies\n3. IT security and acceptable use policies\n4. Privacy and personal information handling\n\nI agree to comply with all policies as a condition of my employment in British Columbia.'
  ),
  (
    'roe',
    'Record of Employment (ROE)',
    'Service Canada ROE file or PDF copy.',
    'offboarding',
    'hr_generated',
    'british_columbia',
    false,
    110,
    E'RECORD OF EMPLOYMENT (ROE)\n\nEmployee: {{full_name}}\nWorker ID: {{worker_id}}\nEnd Date: {{end_date}}\n\nThis document confirms ROE submission details for Service Canada.'
  ),
  (
    'final_pay_stub',
    'Final Pay & Vacation Pay Stub',
    'Final payroll including vacation pay and outstanding amounts.',
    'offboarding',
    'hr_generated',
    'british_columbia',
    false,
    120,
    E'FINAL PAY STUB\n\nEmployee: {{full_name}}\nEnd Date: {{end_date}}\n\nFinal wages and vacation pay per BC Employment Standards Act timelines.'
  ),
  (
    'resignation_letter',
    'Resignation Letter',
    'Employee resignation with last working day.',
    'offboarding',
    'docusign',
    'british_columbia',
    false,
    130,
    E'RESIGNATION LETTER\n\nI, {{full_name}}, hereby resign from my position effective {{end_date}}.\n\nSigned: _________________________\nDate: {{today_date}}'
  ),
  (
    'termination_letter',
    'Termination Letter',
    'Employer termination notice with legal reasons.',
    'offboarding',
    'docusign',
    'british_columbia',
    false,
    140,
    E'TERMINATION LETTER\n\nTo: {{full_name}}\nDate: {{today_date}}\n\nThis letter confirms the termination of your employment effective {{end_date}} in accordance with applicable BC employment law.'
  ),
  (
    'severance_offer',
    'Severance / Notice Offer',
    'Severance package per BC ESA or common law.',
    'offboarding',
    'acknowledge',
    'british_columbia',
    true,
    150,
    E'SEVERANCE / NOTICE OFFER\n\nEmployee: {{full_name}}\nDate: {{today_date}}\n\nThis document outlines the severance or notice offer provided upon separation from employment.'
  ),
  (
    'release_form',
    'Full and Final Release',
    'Legal release upon acceptance of severance. Requires timestamped e-signature.',
    'offboarding',
    'docusign',
    'british_columbia',
    false,
    160,
    E'FULL AND FINAL RELEASE\n\nI, {{full_name}}, in consideration of the severance offered, hereby release the employer from all claims arising from my employment, to the extent permitted by law.\n\nDate: {{today_date}}'
  ),
  (
    'nda_noncompete_reminder',
    'NDA / Non-Compete Reminder',
    'Reminder of ongoing confidentiality obligations after departure.',
    'offboarding',
    'docusign',
    'british_columbia',
    false,
    170,
    E'NDA / NON-COMPETE REMINDER\n\nEmployee: {{full_name}}\nEnd Date: {{end_date}}\n\nThis letter reminds you of continuing confidentiality and restrictive covenant obligations following your departure.'
  ),
  (
    'asset_return',
    'Asset & Digital Access Return Checklist',
    'Return of equipment and closure of digital accounts.',
    'offboarding',
    'docusign',
    'british_columbia',
    false,
    180,
    E'ASSET & DIGITAL ACCESS RETURN CHECKLIST\n\nEmployee: {{full_name}}\nDate: {{today_date}}\n\nI confirm return of all company equipment and deactivation of assigned digital accounts (email, Slack, AWS, etc.).'
  )
ON CONFLICT (code) DO NOTHING;
